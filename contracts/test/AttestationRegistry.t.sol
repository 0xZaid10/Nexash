// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {CapabilityTypes} from "../src/libraries/CapabilityTypes.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry registry;

    address owner = makeAddr("owner");
    address issuer = makeAddr("issuer");
    address subject = makeAddr("subject");
    address stranger = makeAddr("stranger");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        registry = new AttestationRegistry(owner);
        vm.prank(owner);
        registry.registerIssuer(issuer, "Nexash Issuer");
    }

    function test_RegisterIssuer_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.registerIssuer(stranger, "rogue");
    }

    function test_RecordAttestation_OnlyIssuer() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotIssuer.selector, stranger));
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, 0);
    }

    function test_RecordAttestation_ThenIsValid() public {
        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, 0);

        assertTrue(registry.isValid(subject, KYC));
        assertTrue(registry.isValidWithMinLevel(subject, KYC, 2));
        assertFalse(registry.isValidWithMinLevel(subject, KYC, 4));
    }

    function test_Attestation_ExpiresCorrectly() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, expiry);

        assertTrue(registry.isValid(subject, KYC));

        vm.warp(expiry + 1);
        assertFalse(registry.isValid(subject, KYC));
    }

    function test_RevokeAttestation_InvalidatesIt() public {
        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, 0);

        vm.prank(issuer);
        registry.revokeAttestation(subject, KYC);

        assertFalse(registry.isValid(subject, KYC));
    }

    function test_RevokeIssuer_InvalidatesExistingAttestations() public {
        vm.prank(issuer);
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, 0);
        assertTrue(registry.isValid(subject, KYC));

        vm.prank(owner);
        registry.revokeIssuer(issuer);

        assertFalse(registry.isValid(subject, KYC));
    }

    function test_RecordAttestation_RevertsOnZeroReportHash() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidReportAnchor.selector, bytes32(0)));
        registry.recordAttestation(subject, KYC, bytes32(0), keccak256("task"), 3, 0);
    }

    function test_Pause_BlocksRecordAttestation() public {
        vm.prank(owner);
        registry.pause();

        vm.prank(issuer);
        vm.expectRevert();
        registry.recordAttestation(subject, KYC, keccak256("tx"), keccak256("task"), 3, 0);
    }
}
