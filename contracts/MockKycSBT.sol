// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IKycSBT.sol";

/// @title MockKycSBT
/// @notice Mock implementation of HashKey Chain KYC SBT for testnet
/// @dev Ownable2Step prevents accidental ownership transfer
///      Drop-in replacement when official SBT is deployed
contract MockKycSBT is IKycSBT, Ownable2Step {
    struct KycRecord {
        KycLevel  level;
        KycStatus status;
        uint256   createTime;
        string    ensName;
    }

    mapping(address => KycRecord) private _records;

    constructor() Ownable(msg.sender) {}

    function setKyc(
        address account,
        KycLevel level,
        KycStatus status,
        string calldata ensName
    ) external onlyOwner {
        _records[account] = KycRecord({
            level:      level,
            status:     status,
            createTime: block.timestamp,
            ensName:    ensName
        });
    }

    function batchSetKyc(
        address[] calldata accounts,
        KycLevel level,
        KycStatus status
    ) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _records[accounts[i]] = KycRecord({
                level:      level,
                status:     status,
                createTime: block.timestamp,
                ensName:    ""
            });
        }
    }

    function isHuman(address account) external view returns (bool, uint8) {
        KycRecord memory r = _records[account];
        bool approved = r.status == KycStatus.APPROVED && r.level > KycLevel.NONE;
        return (approved, uint8(r.level));
    }

    function getKycInfo(address account) external view returns (
        string memory ensName,
        KycLevel level,
        KycStatus status,
        uint256 createTime
    ) {
        KycRecord memory r = _records[account];
        return (r.ensName, r.level, r.status, r.createTime);
    }

    function revokeKyc(address account) external onlyOwner {
        _records[account].status = KycStatus.REVOKED;
    }
}
