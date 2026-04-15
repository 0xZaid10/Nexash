// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./ZKTreasury.sol";

/// @title TreasuryFactory
/// @notice Deploys new ZKTreasury instances for organizations
/// @dev Ownable2Step protects factory ownership transfer
///      Factory owner can pause new deployments if needed
contract TreasuryFactory is Ownable2Step {

    address public immutable identityVerifier;
    address public immutable policyVerifier;
    address public immutable policyEngine;
    address public immutable kycGate;

    bool public deploymentsPaused;

    address[] public allTreasuries;
    mapping(address => address[]) public orgTreasuries;
    mapping(address => bool) public isTreasury;

    event TreasuryDeployed(
        address indexed treasury,
        address indexed admin,
        string  name,
        uint256 timestamp
    );
    event DeploymentsPaused(address indexed by);
    event DeploymentsUnpaused(address indexed by);

    modifier deploymentsActive() {
        require(!deploymentsPaused, "TreasuryFactory: deployments paused");
        _;
    }

    constructor(
        address _identityVerifier,
        address _policyVerifier,
        address _policyEngine,
        address _kycGate
    ) Ownable(msg.sender) {
        require(_identityVerifier != address(0), "TreasuryFactory: zero identity verifier");
        require(_policyVerifier   != address(0), "TreasuryFactory: zero policy verifier");
        require(_policyEngine     != address(0), "TreasuryFactory: zero policy engine");
        require(_kycGate          != address(0), "TreasuryFactory: zero kyc gate");

        identityVerifier = _identityVerifier;
        policyVerifier   = _policyVerifier;
        policyEngine     = _policyEngine;
        kycGate          = _kycGate;
    }

    /// @notice Deploy a new ZKTreasury for an organization
    function deployTreasury(
        string    calldata name,
        address   admin,
        uint256   spendingLimit,
        uint256   dailySpendLimit,
        uint8     multisigThreshold,
        uint8     minKycLevel,
        uint8     minRole,
        bytes32   jurisdictionsRoot,
        bytes32   policyHash,
        address[] calldata allowedTokens
    ) external deploymentsActive returns (address treasury) {
        require(bytes(name).length > 0,        "TreasuryFactory: empty name");
        require(admin != address(0),            "TreasuryFactory: zero admin");
        require(spendingLimit > 0,              "TreasuryFactory: zero spending limit");
        require(dailySpendLimit >= spendingLimit, "TreasuryFactory: daily < per-tx");

        ZKTreasury t = new ZKTreasury(
            identityVerifier,
            policyVerifier,
            policyEngine,
            kycGate
        );

        t.initialize(
            name, admin,
            spendingLimit, dailySpendLimit,
            multisigThreshold, minKycLevel, minRole,
            jurisdictionsRoot, policyHash,
            allowedTokens
        );

        treasury = address(t);
        allTreasuries.push(treasury);
        orgTreasuries[admin].push(treasury);
        isTreasury[treasury] = true;

        emit TreasuryDeployed(treasury, admin, name, block.timestamp);
    }

    /// @notice Pause new treasury deployments — owner only
    function pauseDeployments() external onlyOwner {
        deploymentsPaused = true;
        emit DeploymentsPaused(msg.sender);
    }

    /// @notice Resume new treasury deployments
    function unpauseDeployments() external onlyOwner {
        deploymentsPaused = false;
        emit DeploymentsUnpaused(msg.sender);
    }

    function getTreasuriesOf(address admin) external view returns (address[] memory) {
        return orgTreasuries[admin];
    }

    function totalTreasuries() external view returns (uint256) {
        return allTreasuries.length;
    }

    function getAllTreasuries() external view returns (address[] memory) {
        return allTreasuries;
    }
}
