// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

library Errors {
    error NotIssuer(address caller);
    error NotOperator(address caller);
    error UnknownIssuer(address issuer);
    error IssuerAlreadyRegistered(address issuer);
    error AttestationNotFound(address subject, bytes32 capability);
    error AttestationExpired(address subject, bytes32 capability, uint64 expiresAt);
    error AttestationRevoked(address subject, bytes32 capability);
    error InvalidReportAnchor(bytes32 reportTxHash);

    error PayeeNotRegistered(address payee);
    error PayeeAlreadyRegistered(address payee);
    error PayeeInactive(address payee);
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);
    error PerPaymentLimitExceeded(uint256 amount, uint256 limit);
    error DailyLimitExceeded(uint256 amount, uint256 remaining);
    error ComplianceRequirementNotMet(address payee, bytes32 requiredCapability);
    error ZeroAddress();
    error ZeroAmount();
    error MandateAlreadySettled(bytes32 mandateHash);
}
