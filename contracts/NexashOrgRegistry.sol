// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NexashOrgRegistry
 * @notice Registry for organisations on Nexash.
 *         - Unique org name (3-20 chars, a-z 0-9 _) linked to admin wallet
 *         - Tracks all treasuries deployed by each org
 *         - One wallet = one org (mutually exclusive with user registry)
 *         - Orgs can have a display name (any chars, up to 50)
 */
contract NexashOrgRegistry is Ownable2Step, ReentrancyGuard {

    // ── State ─────────────────────────────────────────────────────────────

    // user registry address — used to enforce mutual exclusivity
    address public userRegistry;

    struct OrgProfile {
        string   name;            // unique handle: a-z 0-9 _
        string   displayName;     // human-readable name, any chars
        string   description;     // short description
        address  admin;
        uint256  registeredAt;
        uint256  treasuryCount;
        bool     active;
    }

    // org name hash → admin address
    mapping(bytes32 => address) public orgNameToAdmin;

    // admin address → profile
    mapping(address => OrgProfile) public profiles;

    // admin address → list of treasury addresses
    mapping(address => address[]) public orgTreasuries;

    // treasury address → org admin (reverse lookup)
    mapping(address => address) public treasuryToOrg;

    uint256 public totalOrgs;

    // ── Events ────────────────────────────────────────────────────────────

    event OrgRegistered(address indexed admin, string name, string displayName, uint256 timestamp);
    event TreasuryAdded(address indexed admin, address indexed treasury, uint256 total);
    event OrgProfileUpdated(address indexed admin, string displayName, string description);
    event UserRegistrySet(address indexed userRegistry);

    // ── Errors ────────────────────────────────────────────────────────────

    error OrgNameTaken();
    error OrgNameInvalid();
    error AlreadyRegistered();
    error NotRegistered();
    error TreasuryAlreadyAdded();
    error UserMember();
    error ZeroAddress();
    error DisplayNameTooLong();
    error DescriptionTooLong();

    // ── Constructor ───────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Modifiers ─────────────────────────────────────────────────────────

    modifier notUserMember() {
        if (userRegistry != address(0)) {
            (bool isUser,) = _checkIsUser(msg.sender);
            if (isUser) revert UserMember();
        }
        _;
    }

    modifier onlyOrgAdmin() {
        if (!profiles[msg.sender].active) revert NotRegistered();
        _;
    }

    // ── External Functions ────────────────────────────────────────────────

    /**
     * @notice Register an organisation
     * @param name        Unique handle: 3-20 chars, lowercase a-z, 0-9, underscore
     * @param displayName Human-readable name, max 50 chars
     * @param description Short description, max 200 chars
     */
    function registerOrg(
        string calldata name,
        string calldata displayName,
        string calldata description
    ) external nonReentrant notUserMember {
        if (profiles[msg.sender].active) revert AlreadyRegistered();
        if (bytes(displayName).length > 50) revert DisplayNameTooLong();
        if (bytes(description).length > 200) revert DescriptionTooLong();

        bytes32 key = _validateAndHash(name);
        if (orgNameToAdmin[key] != address(0)) revert OrgNameTaken();

        orgNameToAdmin[key] = msg.sender;
        profiles[msg.sender] = OrgProfile({
            name:          name,
            displayName:   displayName,
            description:   description,
            admin:         msg.sender,
            registeredAt:  block.timestamp,
            treasuryCount: 0,
            active:        true
        });

        totalOrgs++;
        emit OrgRegistered(msg.sender, name, displayName, block.timestamp);
    }

    /**
     * @notice Add a deployed treasury to the org's registry
     * @dev Called after deploying via TreasuryFactory
     */
    function addTreasury(address treasury) external nonReentrant onlyOrgAdmin {
        if (treasury == address(0)) revert ZeroAddress();
        if (treasuryToOrg[treasury] != address(0)) revert TreasuryAlreadyAdded();

        orgTreasuries[msg.sender].push(treasury);
        treasuryToOrg[treasury] = msg.sender;
        profiles[msg.sender].treasuryCount++;

        emit TreasuryAdded(msg.sender, treasury, profiles[msg.sender].treasuryCount);
    }

    /**
     * @notice Update org display name and description
     */
    function updateProfile(
        string calldata displayName,
        string calldata description
    ) external onlyOrgAdmin {
        if (bytes(displayName).length > 50) revert DisplayNameTooLong();
        if (bytes(description).length > 200) revert DescriptionTooLong();

        profiles[msg.sender].displayName  = displayName;
        profiles[msg.sender].description  = description;

        emit OrgProfileUpdated(msg.sender, displayName, description);
    }

    // ── View Functions ────────────────────────────────────────────────────

    function resolve(string calldata name) external view returns (address) {
        bytes32 key = keccak256(bytes(_toLower(name)));
        return orgNameToAdmin[key];
    }

    function reverseResolve(address admin) external view returns (string memory) {
        return profiles[admin].name;
    }

    function getProfile(address admin) external view returns (OrgProfile memory) {
        return profiles[admin];
    }

    function getOrgTreasuries(address admin) external view returns (address[] memory) {
        return orgTreasuries[admin];
    }

    function getTreasuryOrg(address treasury) external view returns (address) {
        return treasuryToOrg[treasury];
    }

    function isRegistered(address admin) external view returns (bool) {
        return profiles[admin].active;
    }

    function getOrgNameAvailable(string calldata name) external view returns (bool) {
        bytes32 key = keccak256(bytes(_toLower(name)));
        return orgNameToAdmin[key] == address(0);
    }

    // ── Admin Functions ───────────────────────────────────────────────────

    function setUserRegistry(address _userRegistry) external onlyOwner {
        userRegistry = _userRegistry;
        emit UserRegistrySet(_userRegistry);
    }

    // ── Internal Functions ────────────────────────────────────────────────

    function _validateAndHash(string calldata name) internal pure returns (bytes32) {
        bytes memory b = bytes(name);
        if (b.length < 3 || b.length > 20) revert OrgNameInvalid();
        for (uint i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7a) || // a-z
                         (c >= 0x30 && c <= 0x39) || // 0-9
                         (c == 0x5f);                 // _
            if (!valid) revert OrgNameInvalid();
        }
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

    function _checkIsUser(address wallet) internal view returns (bool, bytes memory) {
        (bool success, bytes memory data) = userRegistry.staticcall(
            abi.encodeWithSignature("isRegistered(address)", wallet)
        );
        if (!success || data.length == 0) return (false, data);
        return (abi.decode(data, (bool)), data);
    }
}
