// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {Errors} from "../../src/libraries/Errors.sol";

contract AttestationRegistryFuzzTest is Test {
    AttestationRegistry registry;

    address owner = makeAddr("owner");
    address issuer = makeAddr("issuer");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        registry = new AttestationRegistry(owner);
        vm.prank(owner);
        registry.registerIssuer(issuer, "Fuzz Issuer");
    }

    /// @dev isValid must agree exactly with the expiry semantics: valid
    ///      strictly before expiresAt, invalid at-or-after, and an
    ///      expiresAt of 0 must mean "never expires" regardless of warp.
    function testFuzz_Expiry_IsValidMatchesTimestamp(
        uint64 expiresAt,
        uint64 warpTo,
        uint8 kycLevel
    ) public {
        address subject = makeAddr(string(abi.encodePacked("subj", expiresAt, warpTo)));

        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), kycLevel, expiresAt);

        vm.warp(bound(warpTo, block.timestamp, type(uint64).max));

        bool expectedValid = expiresAt == 0 || expiresAt >= block.timestamp;
        assertEq(registry.isValid(subject, KYC), expectedValid);
    }

    /// @dev isValidWithMinLevel must never return true if the stored
    ///      kycLevel is below the requested minimum, for any combination.
    function testFuzz_MinLevelCheck_NeverPassesBelowThreshold(
        uint8 storedLevel,
        uint8 requiredMinLevel
    ) public {
        address subject = makeAddr(string(abi.encodePacked("lvlsubj", storedLevel, requiredMinLevel)));

        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), storedLevel, 0);

        bool result = registry.isValidWithMinLevel(subject, KYC, requiredMinLevel);

        if (storedLevel < requiredMinLevel) {
            assertFalse(result, "passed despite storedLevel below required minimum");
        } else {
            assertTrue(result, "failed despite storedLevel meeting required minimum");
        }
    }

    /// @dev Once an issuer is revoked, isValid must return false for EVERY
    ///      attestation that issuer ever signed, for any subject/capability.
    function testFuzz_IssuerRevocation_InvalidatesAllPriorAttestations(
        uint8 numSubjects,
        uint8 kycLevel
    ) public {
        numSubjects = uint8(bound(numSubjects, 1, 15));
        address[] memory subjects = new address[](numSubjects);

        for (uint8 i = 0; i < numSubjects; i++) {
            subjects[i] = makeAddr(string(abi.encodePacked("revsubj", i)));
            vm.prank(issuer);
            registry.recordAttestation(subjects[i], KYC, keccak256(abi.encode(i)), keccak256("task"), kycLevel, 0);
            assertTrue(registry.isValid(subjects[i], KYC));
        }

        vm.prank(owner);
        registry.revokeIssuer(issuer);

        for (uint8 i = 0; i < numSubjects; i++) {
            assertFalse(registry.isValid(subjects[i], KYC), "attestation still valid after issuer revocation");
        }
    }

    /// @dev A re-registered issuer's NEW attestations must be valid again,
    ///      proving revoke -> re-register is a clean state transition.
    function testFuzz_ReRegisteredIssuer_NewAttestationsAreValid(uint8 kycLevel) public {
        address subject = makeAddr("rereg-subject");

        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx1"), keccak256("task"), kycLevel, 0);
        assertTrue(registry.isValid(subject, KYC));

        vm.prank(owner);
        registry.revokeIssuer(issuer);
        assertFalse(registry.isValid(subject, KYC));

        vm.prank(owner);
        registry.registerIssuer(issuer, "Fuzz Issuer Re-registered");

        assertTrue(registry.isValid(subject, KYC), "old attestation should be valid again once issuer re-registered");

        address subject2 = makeAddr("rereg-subject-2");
        vm.prank(issuer);
        registry.recordAttestation(subject2, KYC, keccak256("tx2"), keccak256("task"), kycLevel, 0);
        assertTrue(registry.isValid(subject2, KYC));
    }
}
