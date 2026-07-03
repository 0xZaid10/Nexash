// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import {IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";
import {CapabilityTypes} from "./libraries/CapabilityTypes.sol";
import {Errors} from "./libraries/Errors.sol";

contract AttestationRegistry is IAttestationRegistry, Ownable2Step, Pausable {
    mapping(address issuer => bool registered) private _issuers;
    mapping(address issuer => string label) private _issuerLabels;

    mapping(address subject => mapping(bytes32 capability => CapabilityTypes.Attestation))
        private _attestations;

    modifier onlyIssuer() {
        if (!_issuers[msg.sender]) revert Errors.NotIssuer(msg.sender);
        _;
    }

    constructor(address initialOwner) Ownable2Step() Ownable(initialOwner) {}

    function registerIssuer(address issuer, string calldata label) external onlyOwner {
        if (issuer == address(0)) revert Errors.ZeroAddress();
        if (_issuers[issuer]) revert Errors.IssuerAlreadyRegistered(issuer);
        _issuers[issuer] = true;
        _issuerLabels[issuer] = label;
        emit IssuerRegistered(issuer, label);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        if (!_issuers[issuer]) revert Errors.UnknownIssuer(issuer);
        _issuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    function recordAttestation(
        address subject,
        bytes32 capability,
        bytes32 reportTxHash,
        bytes32 taskId,
        uint8 kycLevel,
        uint64 expiresAt
    ) external onlyIssuer whenNotPaused {
        if (subject == address(0)) revert Errors.ZeroAddress();
        if (reportTxHash == bytes32(0)) revert Errors.InvalidReportAnchor(reportTxHash);

        _attestations[subject][capability] = CapabilityTypes.Attestation({
            subject: subject,
            capability: capability,
            issuer: msg.sender,
            reportTxHash: reportTxHash,
            taskId: taskId,
            kycLevel: kycLevel,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });

        emit AttestationRecorded(
            subject,
            capability,
            msg.sender,
            reportTxHash,
            taskId,
            kycLevel,
            uint64(block.timestamp),
            expiresAt
        );
    }

    function revokeAttestation(address subject, bytes32 capability) external onlyIssuer {
        CapabilityTypes.Attestation storage a = _attestations[subject][capability];
        if (a.subject == address(0)) revert Errors.AttestationNotFound(subject, capability);
        if (a.issuer != msg.sender && msg.sender != owner()) revert Errors.NotIssuer(msg.sender);
        a.revoked = true;
        emit AttestationRevokedEvent(subject, capability);
    }

    function isValid(address subject, bytes32 capability) public view returns (bool) {
        CapabilityTypes.Attestation storage a = _attestations[subject][capability];
        if (a.subject == address(0)) return false;
        if (a.revoked) return false;
        if (a.expiresAt != 0 && a.expiresAt < block.timestamp) return false;
        if (!_issuers[a.issuer]) return false;
        return true;
    }

    function isValidWithMinLevel(
        address subject,
        bytes32 capability,
        uint8 minKycLevel
    ) external view returns (bool) {
        if (!isValid(subject, capability)) return false;
        return _attestations[subject][capability].kycLevel >= minKycLevel;
    }

    function getAttestation(
        address subject,
        bytes32 capability
    ) external view returns (CapabilityTypes.Attestation memory) {
        return _attestations[subject][capability];
    }

    function isIssuer(address issuer) external view returns (bool) {
        return _issuers[issuer];
    }

    function issuerLabel(address issuer) external view returns (string memory) {
        return _issuerLabels[issuer];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
