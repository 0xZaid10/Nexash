// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PolicyEngine
/// @notice Stores and manages treasury compliance policies on-chain
/// @dev The policyHash field stores pedersen_hash([spending_limit, daily_limit,
///      threshold, min_role, treasury]) computed by the frontend to match
///      the transaction_policy Noir circuit exactly.
///      This hash is what the ZK proof verifies against - it cannot use
///      keccak256 because the circuit uses Noir's pedersen_hash.
contract PolicyEngine {

    struct Policy {
        uint256 spendingLimit;
        uint256 dailySpendLimit;
        uint8   multisigThreshold;
        uint8   minKycLevel;
        uint8   minRole;
        bool    active;
        bytes32 allowedJurisdictionsRoot;
        bytes32 policyHash; // pedersen_hash computed by frontend, matches circuit
    }

    // treasury => policy
    mapping(address => Policy) public policies;

    // treasury => operator => daily spend
    mapping(address => mapping(address => uint256)) public dailySpend;

    // treasury => operator => last reset day
    mapping(address => mapping(address => uint256)) public lastResetDay;

    event PolicySet(address indexed treasury, bytes32 policyHash);
    event DailySpendUpdated(address indexed treasury, address indexed operator, uint256 newTotal);

    modifier onlyTreasury() {
        require(policies[msg.sender].active, "PolicyEngine: not registered treasury");
        _;
    }

    /// @notice Register or update policy for a treasury
    /// @param policyHash pedersen_hash([spendingLimit, dailySpendLimit, multisigThreshold, minRole, treasury])
    ///                   computed by the frontend using the same algorithm as the Noir circuit
    function setPolicy(
        uint256 spendingLimit,
        uint256 dailySpendLimit,
        uint8   multisigThreshold,
        uint8   minKycLevel,
        uint8   minRole,
        bytes32 allowedJurisdictionsRoot,
        bytes32 policyHash
    ) external {
        require(spendingLimit > 0,   "PolicyEngine: zero spending limit");
        require(dailySpendLimit >= spendingLimit, "PolicyEngine: daily < per-tx");

        policies[msg.sender] = Policy({
            spendingLimit:            spendingLimit,
            dailySpendLimit:          dailySpendLimit,
            multisigThreshold:        multisigThreshold,
            minKycLevel:              minKycLevel,
            minRole:                  minRole,
            active:                   true,
            allowedJurisdictionsRoot: allowedJurisdictionsRoot,
            policyHash:               policyHash
        });

        emit PolicySet(msg.sender, policyHash);
    }

    /// @notice Record spend for daily limit tracking
    function recordSpend(address operator, uint256 amount) external onlyTreasury {
        uint256 today = block.timestamp / 1 days;

        if (lastResetDay[msg.sender][operator] < today) {
            dailySpend[msg.sender][operator]    = 0;
            lastResetDay[msg.sender][operator]  = today;
        }

        dailySpend[msg.sender][operator] += amount;

        emit DailySpendUpdated(msg.sender, operator, dailySpend[msg.sender][operator]);
    }

    /// @notice Get current daily spend for an operator (resets at midnight)
    function getDailySpend(address treasury, address operator) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (lastResetDay[treasury][operator] < today) return 0;
        return dailySpend[treasury][operator];
    }

    /// @notice Get stored policy hash (pedersen, matches circuit)
    function getPolicyHash(address treasury) external view returns (bytes32) {
        return policies[treasury].policyHash;
    }

    /// @notice Get full policy for a treasury
    function getPolicy(address treasury) external view returns (Policy memory) {
        return policies[treasury];
    }

    /// @notice Check if a treasury has an active policy
    function isRegistered(address treasury) external view returns (bool) {
        return policies[treasury].active;
    }
}
