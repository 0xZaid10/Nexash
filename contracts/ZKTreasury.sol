// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IZKTreasury.sol";
import "./interfaces/IKycSBT.sol";
import "./PolicyEngine.sol";
import "./KYCGate.sol";

interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title ZKTreasury
/// @notice Institutional treasury with ZK-proof-gated compliance
/// @dev Uses OZ AccessControl for flexible role management,
///      OZ Pausable for emergency stops,
///      OZ Ownable2Step for safe admin transfer
///
/// Roles:
///   ADMIN_ROLE     — full control, policy updates, pause, token allowlist
///   OPERATOR_ROLE  — initiate and approve payments
///   VIEWER_ROLE    — read-only (no on-chain actions, used for off-chain checks)
///   Organizations can define additional custom roles via grantRole()
///
/// Identity proof public input indices (6 total):
///   [0] min_kyc_level
///   [1] allowed_jurisdictions_root
///   [2] nullifier
///   [3] treasury_address
///   [4] proof_timestamp
///   [5] expiry_window
///
/// Policy proof public input indices (7 total):
///   [0] policy_hash
///   [1] requires_multisig
///   [2] multisig_threshold
///   [3] min_role
///   [4] payment_request_id
///   [5] treasury_address
///   [6] proof_timestamp
contract ZKTreasury is ReentrancyGuard, Pausable, AccessControl, IZKTreasury {
    using SafeERC20 for IERC20;

    // ─── Roles ────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VIEWER_ROLE   = keccak256("VIEWER_ROLE");

    // ─── Public input indices ─────────────────────────────
    uint256 private constant ID_IDX_NULLIFIER       = 2;
    uint256 private constant ID_IDX_TREASURY        = 3;
    uint256 private constant ID_IDX_TIMESTAMP       = 4;
    uint256 private constant ID_PUBLIC_INPUTS_COUNT = 6;

    uint256 private constant POL_IDX_POLICY_HASH        = 0;
    uint256 private constant POL_IDX_REQUIRES_MULTISIG  = 1;
    uint256 private constant POL_IDX_PAYMENT_REQ_ID     = 4;
    uint256 private constant POL_IDX_TREASURY           = 5;
    uint256 private constant POL_IDX_TIMESTAMP          = 6;
    uint256 private constant POL_PUBLIC_INPUTS_COUNT    = 7;

    // ─── Constants ────────────────────────────────────────
    uint256 public constant PROOF_EXPIRY = 1 hours;
    uint256 public constant MAX_SIGNERS  = 10;

    // ─── Immutables ───────────────────────────────────────
    IHonkVerifier public immutable identityVerifier;
    IHonkVerifier public immutable policyVerifier;
    PolicyEngine  public immutable policyEngine;
    KYCGate       public immutable kycGate;

    // ─── State ────────────────────────────────────────────
    string public name;
    bool   public initialized;

    // Legacy role tracking for IZKTreasury interface compatibility
    mapping(address => Role) public roles;
    address[] public members;

    mapping(address => bool) public allowedTokens;
    address[]                public tokenList;

    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => bool) public usedPaymentRequests;

    mapping(bytes32 => PendingPayment)                   public pendingPayments;
    mapping(bytes32 => mapping(address => bool))         public hasApproved;

    // ─── Events ───────────────────────────────────────────
    event TokenAllowed(address indexed token);
    event TokenRemoved(address indexed token);

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "ZKTreasury: not admin");
        _;
    }

    modifier onlyOperator() {
        require(
            hasRole(OPERATOR_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "ZKTreasury: not operator"
        );
        _;
    }

    modifier onlyInitialized() {
        require(initialized, "ZKTreasury: not initialized");
        _;
    }

    modifier onlyAllowedToken(address token) {
        require(allowedTokens[token], "ZKTreasury: token not allowed");
        _;
    }

    // ─── Constructor ──────────────────────────────────────
    constructor(
        address _identityVerifier,
        address _policyVerifier,
        address _policyEngine,
        address _kycGate
    ) {
        require(_identityVerifier != address(0), "ZKTreasury: zero identity verifier");
        require(_policyVerifier   != address(0), "ZKTreasury: zero policy verifier");
        require(_policyEngine     != address(0), "ZKTreasury: zero policy engine");
        require(_kycGate          != address(0), "ZKTreasury: zero kyc gate");

        identityVerifier = IHonkVerifier(_identityVerifier);
        policyVerifier   = IHonkVerifier(_policyVerifier);
        policyEngine     = PolicyEngine(_policyEngine);
        kycGate          = KYCGate(_kycGate);

        // Set up role hierarchy:
        // ADMIN_ROLE can manage OPERATOR_ROLE and VIEWER_ROLE
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VIEWER_ROLE,   ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE,    ADMIN_ROLE);
    }

    // ─── Initialization ───────────────────────────────────
    function initialize(
        string    calldata _name,
        address   _admin,
        uint256   _spendingLimit,
        uint256   _dailySpendLimit,
        uint8     _multisigThreshold,
        uint8     _minKycLevel,
        uint8     _minRole,
        bytes32   _allowedJurisdictionsRoot,
        bytes32   _policyHash,
        address[] calldata _allowedTokens
    ) external {
        require(!initialized,                        "ZKTreasury: already initialized");
        require(_admin != address(0),                "ZKTreasury: zero admin");
        require(_spendingLimit > 0,                  "ZKTreasury: zero spending limit");
        require(_dailySpendLimit >= _spendingLimit,  "ZKTreasury: daily < per-tx limit");
        require(bytes(_name).length > 0,             "ZKTreasury: empty name");

        name        = _name;
        initialized = true;

        // Grant OZ AccessControl roles
        _grantRole(ADMIN_ROLE, _admin);

        // Legacy role tracking for interface compatibility
        roles[_admin] = Role.ADMIN;
        members.push(_admin);

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            _allowToken(_allowedTokens[i]);
        }

        policyEngine.setPolicy(
            _spendingLimit,
            _dailySpendLimit,
            _multisigThreshold,
            _minKycLevel,
            _minRole,
            _allowedJurisdictionsRoot,
            _policyHash
        );

        emit TreasuryCreated(address(this), _admin);
        emit RoleGranted(_admin, Role.ADMIN);
    }

    // ─── Role management (OZ AccessControl + legacy) ──────

    /// @notice Grant a role to an account
    /// @dev Extends OZ grantRole with legacy tracking and member list
    ///      Supports custom roles beyond ADMIN/OPERATOR/VIEWER
    function grantTreasuryRole(address account, bytes32 role)
        external onlyAdmin onlyInitialized
    {
        require(account != address(0),        "ZKTreasury: zero address");
        require(members.length < MAX_SIGNERS, "ZKTreasury: max members");

        _grantRole(role, account);

        // Legacy tracking
        if (role == ADMIN_ROLE) {
            _setLegacyRole(account, Role.ADMIN);
        } else if (role == OPERATOR_ROLE) {
            _setLegacyRole(account, Role.OPERATOR);
        } else if (role == VIEWER_ROLE) {
            _setLegacyRole(account, Role.VIEWER);
        }
        // Custom roles get VIEWER in legacy system
        else {
            _setLegacyRole(account, Role.VIEWER);
        }
    }

    /// @notice Revoke a role from an account
    function revokeTreasuryRole(address account, bytes32 role)
        external onlyAdmin onlyInitialized
    {
        require(
            !(role == ADMIN_ROLE && account == msg.sender),
            "ZKTreasury: cannot revoke own admin"
        );
        _revokeRole(role, account);

        // Update legacy role if no remaining roles
        if (!hasRole(ADMIN_ROLE, account) && !hasRole(OPERATOR_ROLE, account)) {
            roles[account] = Role.NONE;
        }
        emit RoleRevoked(account, Role.NONE);
    }

    /// @notice Convenience: grant OPERATOR role
    function grantRole(address account, Role role)
        external onlyAdmin onlyInitialized
    {
        require(account != address(0),        "ZKTreasury: zero address");
        require(role != Role.NONE,             "ZKTreasury: cannot grant NONE");
        require(members.length < MAX_SIGNERS, "ZKTreasury: max members");

        bytes32 ozRole = _toOZRole(role);
        _grantRole(ozRole, account);
        _setLegacyRole(account, role);
    }

    function revokeRole(address account)
        external onlyAdmin onlyInitialized
    {
        require(account != msg.sender, "ZKTreasury: cannot revoke self");
        _revokeRole(ADMIN_ROLE, account);
        _revokeRole(OPERATOR_ROLE, account);
        _revokeRole(VIEWER_ROLE, account);
        roles[account] = Role.NONE;
        emit RoleRevoked(account, Role.NONE);
    }

    // ─── Admin functions ──────────────────────────────────
    function updatePolicy(
        uint256 _spendingLimit,
        uint256 _dailySpendLimit,
        uint8   _multisigThreshold,
        uint8   _minKycLevel,
        uint8   _minRole,
        bytes32 _allowedJurisdictionsRoot,
        bytes32 _policyHash
    ) external onlyAdmin onlyInitialized {
        require(_spendingLimit > 0, "ZKTreasury: zero spending limit");
        require(_dailySpendLimit >= _spendingLimit, "ZKTreasury: daily < per-tx limit");
        policyEngine.setPolicy(
            _spendingLimit, _dailySpendLimit, _multisigThreshold,
            _minKycLevel, _minRole, _allowedJurisdictionsRoot, _policyHash
        );
        emit PolicyUpdated(_policyHash);
    }

    function allowToken(address token) external onlyAdmin onlyInitialized {
        _allowToken(token);
    }

    function removeToken(address token) external onlyAdmin onlyInitialized {
        allowedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /// @notice Pause all payment operations — OZ Pausable
    function pause() external onlyAdmin onlyInitialized {
        _pause();
    }

    /// @notice Unpause — OZ Pausable
    function unpause() external onlyAdmin onlyInitialized {
        _unpause();
    }

    // ─── Core payment flow ────────────────────────────────
    function initiatePayment(
        address   token,
        address   recipient,
        uint256   amount,
        bytes32   paymentReqId,
        bytes     calldata identityProof,
        bytes32[] calldata identityPubInputs,
        bytes     calldata policyProof,
        bytes32[] calldata policyPubInputs
    )
        external
        onlyOperator
        onlyInitialized
        whenNotPaused
        onlyAllowedToken(token)
        nonReentrant
    {
        require(recipient    != address(0), "ZKTreasury: zero recipient");
        require(amount       > 0,           "ZKTreasury: zero amount");
        require(paymentReqId != bytes32(0), "ZKTreasury: invalid payment request");
        require(!usedPaymentRequests[paymentReqId], "ZKTreasury: payment request already used");
        require(identityPubInputs.length == ID_PUBLIC_INPUTS_COUNT,  "ZKTreasury: wrong identity input count");
        require(policyPubInputs.length   == POL_PUBLIC_INPUTS_COUNT, "ZKTreasury: wrong policy input count");

        require(
            identityVerifier.verify(identityProof, identityPubInputs),
            "ZKTreasury: invalid identity proof"
        );

        bytes32 nullifier = identityPubInputs[ID_IDX_NULLIFIER];
        require(!usedNullifiers[nullifier], "ZKTreasury: nullifier already used");

        uint256 idTimestamp = uint256(identityPubInputs[ID_IDX_TIMESTAMP]);
        require(block.timestamp <= idTimestamp + PROOF_EXPIRY, "ZKTreasury: identity proof expired");

        bytes32 expectedTreasury = bytes32(uint256(uint160(address(this))));
        require(identityPubInputs[ID_IDX_TREASURY] == expectedTreasury, "ZKTreasury: proof bound to different treasury");

        require(
            policyVerifier.verify(policyProof, policyPubInputs),
            "ZKTreasury: invalid policy proof"
        );

        require(
            policyPubInputs[POL_IDX_POLICY_HASH] == policyEngine.getPolicyHash(address(this)),
            "ZKTreasury: policy hash mismatch"
        );
        require(policyPubInputs[POL_IDX_PAYMENT_REQ_ID] == paymentReqId, "ZKTreasury: policy proof bound to different payment");
        require(policyPubInputs[POL_IDX_TREASURY] == expectedTreasury,   "ZKTreasury: policy proof treasury mismatch");

        uint256 polTimestamp = uint256(policyPubInputs[POL_IDX_TIMESTAMP]);
        require(block.timestamp <= polTimestamp + PROOF_EXPIRY, "ZKTreasury: policy proof expired");

        PolicyEngine.Policy memory policy = policyEngine.getPolicy(address(this));
        require(kycGate.meetsKycLevel(recipient, policy.minKycLevel), "ZKTreasury: recipient KYC insufficient");
        require(IERC20(token).balanceOf(address(this)) >= amount, "ZKTreasury: insufficient balance");

        usedNullifiers[nullifier]         = true;
        usedPaymentRequests[paymentReqId] = true;

        emit NullifierUsed(nullifier);
        emit IdentityVerified(msg.sender, nullifier);

        bool requiresMultisig = policyPubInputs[POL_IDX_REQUIRES_MULTISIG] == bytes32(uint256(1));

        if (!requiresMultisig || policy.multisigThreshold <= 1) {
            _executePayment(token, recipient, amount, paymentReqId);
        } else {
            _queuePayment(token, recipient, amount, paymentReqId, policy.multisigThreshold);
        }
    }

    function approvePayment(bytes32 paymentReqId)
        external onlyOperator onlyInitialized whenNotPaused nonReentrant
    {
        PendingPayment storage payment = pendingPayments[paymentReqId];
        require(payment.amount > 0,                        "ZKTreasury: payment not found");
        require(!payment.executed,                          "ZKTreasury: already executed");
        require(!hasApproved[paymentReqId][msg.sender],     "ZKTreasury: already approved");

        hasApproved[paymentReqId][msg.sender] = true;
        payment.approvals++;
        emit PaymentApproved(paymentReqId, msg.sender);

        PolicyEngine.Policy memory policy = policyEngine.getPolicy(address(this));
        if (payment.approvals >= policy.multisigThreshold) {
            _executePayment(payment.token, payment.recipient, payment.amount, paymentReqId);
            payment.executed = true;
        }
    }

    function rejectPayment(bytes32 paymentReqId) external onlyAdmin onlyInitialized {
        PendingPayment storage payment = pendingPayments[paymentReqId];
        require(payment.amount > 0, "ZKTreasury: payment not found");
        require(!payment.executed,   "ZKTreasury: already executed");
        payment.executed = true;
        emit PaymentRejected(paymentReqId);
    }

    // ─── Internal ─────────────────────────────────────────
    function _executePayment(address token, address recipient, uint256 amount, bytes32 paymentReqId) internal {
        policyEngine.recordSpend(msg.sender, amount);
        IERC20(token).safeTransfer(recipient, amount);
        emit PaymentExecuted(paymentReqId, recipient, amount);
    }

    function _queuePayment(address token, address recipient, uint256 amount, bytes32 paymentReqId, uint8 threshold) internal {
        pendingPayments[paymentReqId] = PendingPayment({
            paymentRequestId: paymentReqId,
            token:            token,
            recipient:        recipient,
            amount:           amount,
            approvals:        1,
            executed:         false,
            createdAt:        block.timestamp
        });
        hasApproved[paymentReqId][msg.sender] = true;
        emit PaymentInitiated(paymentReqId, recipient, token, amount);
        threshold;
    }

    function _allowToken(address token) internal {
        require(token != address(0), "ZKTreasury: zero token");
        if (!allowedTokens[token]) {
            allowedTokens[token] = true;
            tokenList.push(token);
            emit TokenAllowed(token);
        }
    }

    function _setLegacyRole(address account, Role role) internal {
        if (roles[account] == Role.NONE) {
            members.push(account);
        }
        roles[account] = role;
        emit RoleGranted(account, role);
    }

    function _toOZRole(Role role) internal pure returns (bytes32) {
        if (role == Role.ADMIN)    return ADMIN_ROLE;
        if (role == Role.OPERATOR) return OPERATOR_ROLE;
        return VIEWER_ROLE;
    }

    // ─── View ─────────────────────────────────────────────
    function getBalance(address token) external view returns (uint256) { return IERC20(token).balanceOf(address(this)); }
    function getMemberCount() external view returns (uint256) { return members.length; }
    function getMembers() external view returns (address[] memory) { return members; }
    function getAllowedTokens() external view returns (address[] memory) { return tokenList; }
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) { return usedNullifiers[nullifier]; }
    function getPendingPayment(bytes32 id) external view returns (PendingPayment memory) { return pendingPayments[id]; }

    /// @notice Check if account has a specific custom role
    function hasCustomRole(bytes32 role, address account) external view returns (bool) {
        return hasRole(role, account);
    }

    receive() external payable {}
}
