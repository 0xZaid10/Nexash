// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {CapabilityTypes} from "../libraries/CapabilityTypes.sol";

interface IAttestationRegistry {
    event IssuerRegistered(address indexed issuer, string label);
    event IssuerRevoked(address indexed issuer);

    event AttestationRecorded(
        address indexed subject,
        bytes32 indexed capability,
        address indexed issuer,
        bytes32 reportTxHash,
        bytes32 taskId,
        uint8 kycLevel,
        uint64 issuedAt,
        uint64 expiresAt
    );

    event AttestationRevokedEvent(address indexed subject, bytes32 indexed capability);

    function registerIssuer(address issuer, string calldata label) external;

    function revokeIssuer(address issuer) external;

    function recordAttestation(
        address subject,
        bytes32 capability,
        bytes32 reportTxHash,
        bytes32 taskId,
        uint8 kycLevel,
        uint64 expiresAt
    ) external;

    function revokeAttestation(address subject, bytes32 capability) external;

    function isValid(address subject, bytes32 capability) external view returns (bool);

    function isValidWithMinLevel(
        address subject,
        bytes32 capability,
        uint8 minKycLevel
    ) external view returns (bool);

    function getAttestation(
        address subject,
        bytes32 capability
    ) external view returns (CapabilityTypes.Attestation memory);

    function isIssuer(address issuer) external view returns (bool);
}
