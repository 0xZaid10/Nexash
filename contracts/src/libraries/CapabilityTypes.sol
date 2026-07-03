// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

library CapabilityTypes {
    bytes32 internal constant ATTESTS_KYC_V1 = keccak256("attests:kyc:v1");
    bytes32 internal constant ATTESTS_SANCTIONS_V1 = keccak256("attests:sanctions:v1");

    enum KycLevel {
        NONE,
        BASIC,
        STANDARD,
        ENHANCED,
        ULTIMATE
    }

    struct Attestation {
        address subject;
        bytes32 capability;
        address issuer;
        bytes32 reportTxHash;
        bytes32 taskId;
        uint8 kycLevel;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
    }

    struct PayeePolicy {
        address payee;
        bytes32 requiredCapability;
        uint8 minKycLevel;
        uint256 perPaymentLimit;
        uint256 dailyLimit;
        bool active;
    }
}
