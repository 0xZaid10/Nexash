// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IKycSBT.sol";

/// @title KYCGate
/// @notice Secondary compliance layer using HashKey Chain KYC SBT
/// @dev Ownable2Step prevents accidental ownership transfer to wrong address
contract KYCGate is Ownable2Step {
    IKycSBT public kycSBT;

    event KycSBTUpdated(address indexed newKycSBT);

    constructor(address _kycSBT) Ownable(msg.sender) {
        require(_kycSBT != address(0), "KYCGate: zero kycSBT");
        kycSBT = IKycSBT(_kycSBT);
    }

    /// @notice Update KYC SBT address — requires two-step ownership transfer to prevent accidents
    function updateKycSBT(address _newKycSBT) external onlyOwner {
        require(_newKycSBT != address(0), "KYCGate: zero address");
        kycSBT = IKycSBT(_newKycSBT);
        emit KycSBTUpdated(_newKycSBT);
    }

    function meetsKycLevel(address account, uint8 minLevel) external view returns (bool) {
        (bool isHuman, uint8 level) = kycSBT.isHuman(account);
        return isHuman && level >= minLevel;
    }

    function getKycLevel(address account) external view returns (uint8) {
        (, uint8 level) = kycSBT.isHuman(account);
        return level;
    }

    function isApproved(address account) external view returns (bool) {
        (bool isHuman,) = kycSBT.isHuman(account);
        return isHuman;
    }
}
