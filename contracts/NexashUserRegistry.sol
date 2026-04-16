// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

/**
 * @title NexashUserRegistry
 * @notice Registry for individual users on Nexash.
 *         - Unique username (3-20 chars, a-z 0-9 _) linked to wallet address
 *         - On-chain ZK identity verification via IdentityVerifier
 *         - One wallet = one username (mutually exclusive with org registry)
 *         - Verified status stored on-chain after proof verification
 */
contract NexashUserRegistry is Ownable2Step, ReentrancyGuard {

    // - State -

    IIdentityVerifier public identityVerifier;

    // org registry address - used to enforce mutual exclusivity
    address public orgRegistry;

    struct UserProfile {
        string   username;
        address  wallet;
        bool     verified;        // has passed ZK identity verification
        uint8    kycLevel;        // from ZK proof public inputs
        bytes32  nullifier;       // prevents re-verification with same proof
        bytes32  reportTxHash;    // NexaID on-chain attestation tx hash
        bytes32  taskId;          // NexaID attestation task ID
        uint256  registeredAt;
        uint256  verifiedAt;
    }

    // username hash - > wallet address
    mapping(bytes32 => address) public usernameToAddress;

    // wallet - > profile
    mapping(address => UserProfile) public profiles;

    // nullifier - > used (prevents proof replay)
    mapping(bytes32 => bool) public usedNullifiers;

    uint256 public totalUsers;
    uint256 public totalVerified;

    // - Events ------------------------------

    event UserRegistered(address indexed wallet, string username, uint256 timestamp);
    event UserVerified(address indexed wallet, uint8 kycLevel, bytes32 nullifier);
    event UsernameChanged(address indexed wallet, string oldUsername, string newUsername);
    event IdentityVerifierUpdated(address indexed newVerifier);
    event OrgRegistrySet(address indexed orgRegistry);

    // - Errors ------------------------------

    error UsernameTaken();
    error UsernameInvalid();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyVerified();
    error NullifierUsed();
    error InvalidProof();
    error OrgMember();
    error ZeroAddress();
    error TreasuryMismatch();

    // - Constructor ---------------------------- >

    constructor(address _identityVerifier) Ownable(msg.sender) {
        if (_identityVerifier == address(0)) revert ZeroAddress();
        identityVerifier = IIdentityVerifier(_identityVerifier);
    }

    // - Modifiers ----------------------------- >

    modifier notOrgMember() {
        if (orgRegistry != address(0)) {
            (bool isOrg,) = _checkIsOrg(msg.sender);
            if (isOrg) revert OrgMember();
        }
        _;
    }

    // - External Functions ------------------------

    /**
     * @notice Register a username linked to the caller's wallet
     * @param username 3-20 chars, lowercase a-z, 0-9, underscore only
     */
    function register(string calldata username) external nonReentrant notOrgMember {
        if (bytes(profiles[msg.sender].username).length > 0) revert AlreadyRegistered();

        bytes32 key = _validateAndHash(username);
        if (usernameToAddress[key] != address(0)) revert UsernameTaken();

        usernameToAddress[key] = msg.sender;
        profiles[msg.sender] = UserProfile({
            username:     username,
            wallet:       msg.sender,
            verified:     false,
            kycLevel:     0,
            nullifier:    bytes32(0),
            reportTxHash: bytes32(0),
            taskId:       bytes32(0),
            registeredAt: block.timestamp,
            verifiedAt:   0
        });

        totalUsers++;
        emit UserRegistered(msg.sender, username, block.timestamp);
    }

    /**
     * @notice Verify identity on-chain using a ZK proof from Nexash identity circuit
     * @param proof           UltraHonk proof bytes
     * @param publicInputs    Public inputs from identity circuit
     * @param reportTxHash    NexaID on-chain attestation tx hash (trustless anchor)
     * @param taskId          NexaID attestation task ID
     *
     * Public input layout (matches identity_compliance Noir circuit v2):
     *   [0] min_kyc_level
     *   [1] allowed_jurisdictions_root
     *   [2] nullifier
     *   [3] treasury_address
     *   [4] proof_timestamp
     *   [5] expiry_window
     *   [6] report_tx_hash_public
     */
    function verifyIdentity(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        bytes32 reportTxHash,
        bytes32 taskId
    ) external nonReentrant {
        if (bytes(profiles[msg.sender].username).length == 0) revert NotRegistered();
        if (profiles[msg.sender].verified) revert AlreadyVerified();
        if (publicInputs.length < 7) revert InvalidProof();
        if (reportTxHash == bytes32(0)) revert InvalidProof();

        // Extract nullifier from public inputs [2]
        bytes32 nullifier = publicInputs[2];
        if (usedNullifiers[nullifier]) revert NullifierUsed();

        // Treasury address in proof must match this registry contract
        bytes32 treasuryField = publicInputs[3];
        bytes32 expectedTreasury = bytes32(uint256(uint160(address(this))));
        if (treasuryField != expectedTreasury) revert TreasuryMismatch();

        // Verify proof on-chain via IdentityVerifier
        bool valid = identityVerifier.verify(proof, publicInputs);
        if (!valid) revert InvalidProof();

        // Extract KYC level from public inputs [0]
        uint8 kycLevel = uint8(uint256(publicInputs[0]));

        // Store nullifier
        usedNullifiers[nullifier] = true;

        // Update profile - store attestation anchors for institution lookup
        profiles[msg.sender].verified     = true;
        profiles[msg.sender].kycLevel     = kycLevel;
        profiles[msg.sender].nullifier    = nullifier;
        profiles[msg.sender].reportTxHash = reportTxHash;
        profiles[msg.sender].taskId       = taskId;
        profiles[msg.sender].verifiedAt   = block.timestamp;

        totalVerified++;
        emit UserVerified(msg.sender, kycLevel, nullifier);
    }

    // - View Functions --------------------------

    function resolve(string calldata username) external view returns (address) {
        bytes32 key = keccak256(bytes(_toLower(username)));
        return usernameToAddress[key];
    }

    function reverseResolve(address wallet) external view returns (string memory) {
        return profiles[wallet].username;
    }

    function getProfile(address wallet) external view returns (UserProfile memory) {
        return profiles[wallet];
    }

    function isVerified(address wallet) external view returns (bool) {
        return profiles[wallet].verified;
    }

    function isRegistered(address wallet) external view returns (bool) {
        return bytes(profiles[wallet].username).length > 0;
    }

    function getUsernameAvailable(string calldata username) external view returns (bool) {
        bytes32 key = _validateAndHashView(username);
        return usernameToAddress[key] == address(0);
    }

    // - Admin Functions -------------------------- >

    function setOrgRegistry(address _orgRegistry) external onlyOwner {
        orgRegistry = _orgRegistry;
        emit OrgRegistrySet(_orgRegistry);
    }

    function setIdentityVerifier(address _verifier) external onlyOwner {
        if (_verifier == address(0)) revert ZeroAddress();
        identityVerifier = IIdentityVerifier(_verifier);
        emit IdentityVerifierUpdated(_verifier);
    }

    // - Internal Functions ------------------------

    function _validateAndHash(string calldata username) internal pure returns (bytes32) {
        bytes memory b = bytes(username);
        if (b.length < 3 || b.length > 20) revert UsernameInvalid();
        for (uint i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7a) || // a-z
                         (c >= 0x30 && c <= 0x39) || // 0-9
                         (c == 0x5f);                 // _
            if (!valid) revert UsernameInvalid();
        }
        return keccak256(b);
    }

    function _validateAndHashView(string calldata username) internal pure returns (bytes32) {
        bytes memory b = bytes(username);
        if (b.length < 3 || b.length > 20) revert UsernameInvalid();
        return keccak256(b);
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                b[i] = bytes1(uint8(b[i]) + 32);
            }
        }
        return string(b);
    }

    function _checkIsOrg(address wallet) internal view returns (bool, bytes memory) {
        (bool success, bytes memory data) = orgRegistry.staticcall(
            abi.encodeWithSignature("isRegistered(address)", wallet)
        );
        if (!success || data.length == 0) return (false, data);
        return (abi.decode(data, (bool)), data);
    }
}
