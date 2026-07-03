// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {PayrollTreasury} from "../src/PayrollTreasury.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

contract MockStablecoin is ERC20 {
    constructor() ERC20("Mock Stablecoin", "mUSDC") {
        _mint(msg.sender, 10_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// @notice End-to-end flow mirroring the real Nexash pipeline:
///         NexaID attestation -> issuer signs on-chain record -> treasury
///         checks it before releasing a payroll payment. Also exercises the
///         failure path: an issuer being revoked must immediately invalidate
///         every attestation it issued, blocking any payment gated on it.
contract IntegrationTest is Test {
    AttestationRegistry registry;
    PayrollTreasury treasury;
    MockStablecoin token;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address nexashIssuer = makeAddr("nexashIssuer");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        vm.startPrank(owner);
        registry = new AttestationRegistry(owner);
        registry.registerIssuer(nexashIssuer, "Nexash Hackathon Developer Issuer");
        treasury = new PayrollTreasury(owner, address(registry), operator);
        vm.stopPrank();

        token = new MockStablecoin();
        token.transfer(address(treasury), 1_000_000e6);

        vm.startPrank(operator);
        treasury.registerPayee(alice, KYC, 2, 2_000e6, 10_000e6);
        treasury.registerPayee(bob, KYC, 3, 2_000e6, 10_000e6);
        vm.stopPrank();
    }

    /// @dev Mirrors the real pipeline: a NexaID reportTxHash anchors a KYC
    ///      level, the Nexash issuer signs that as an on-chain attestation.
    function _attest(address subject, uint8 kycLevel, bytes32 reportTxHash) internal {
        vm.prank(nexashIssuer);
        registry.recordAttestation(subject, KYC, reportTxHash, keccak256("task"), kycLevel, 0);
    }

    function test_FullPayrollRun_TwoPayeesBothCompliant() public {
        _attest(alice, 3, keccak256("nexaid-report-alice"));
        _attest(bob, 4, keccak256("nexaid-report-bob"));

        vm.startPrank(operator);
        treasury.releasePayment(alice, address(token), 1_500e6, keccak256("payroll-run-1-alice"));
        treasury.releasePayment(bob, address(token), 1_800e6, keccak256("payroll-run-1-bob"));
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 1_500e6);
        assertEq(token.balanceOf(bob), 1_800e6);
    }

    function test_PayrollRun_BlocksPayeeBelowRequiredKycLevel() public {
        _attest(alice, 3, keccak256("nexaid-report-alice"));
        _attest(bob, 2, keccak256("nexaid-report-bob")); // bob requires level 3, only has 2

        vm.prank(operator);
        treasury.releasePayment(alice, address(token), 1_500e6, keccak256("payroll-run-1-alice"));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRequirementNotMet.selector, bob, KYC));
        treasury.releasePayment(bob, address(token), 1_800e6, keccak256("payroll-run-1-bob"));

        assertEq(token.balanceOf(alice), 1_500e6);
        assertEq(token.balanceOf(bob), 0);
    }

    /// @dev The critical compliance-integrity test: if the issuer that backed
    ///      an attestation is later revoked (e.g. its key was compromised, or
    ///      it loses trust), every payment gated on that attestation must
    ///      stop working immediately, even though the attestation record
    ///      itself still physically exists in storage.
    function test_IssuerRevocation_ImmediatelyBlocksDependentPayments() public {
        _attest(alice, 3, keccak256("nexaid-report-alice"));

        vm.prank(operator);
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-1-alice"));
        assertEq(token.balanceOf(alice), 1_000e6);

        vm.prank(owner);
        registry.revokeIssuer(nexashIssuer);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRequirementNotMet.selector, alice, KYC));
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-2-alice"));
    }

    function test_AttestationExpiry_BlocksPaymentAfterWindow() public {
        uint64 expiry = uint64(block.timestamp + 30 days);

        vm.prank(nexashIssuer);
        registry.recordAttestation(alice, KYC, keccak256("nexaid-report-alice"), keccak256("task"), 3, expiry);

        vm.prank(operator);
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-1-alice"));

        vm.warp(expiry + 1);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRequirementNotMet.selector, alice, KYC));
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-2-alice"));
    }

    function test_RecurringPayrollAcrossMultipleDays_RespectsDailyLimitsIndependently() public {
        _attest(alice, 3, keccak256("nexaid-report-alice"));
        // alice's dailyLimit is 10_000e6, perPaymentLimit is 2_000e6 (setUp).
        // Spend exactly up to the daily limit across 5 payments of 2_000e6.
        vm.startPrank(operator);
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-1")); // running: 2_000e6
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-2")); // running: 4_000e6
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-3")); // running: 6_000e6
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-4")); // running: 8_000e6
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-5")); // running: 10_000e6, remaining: 0

        vm.expectRevert(
            abi.encodeWithSelector(Errors.DailyLimitExceeded.selector, 2_000e6, 0)
        );
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day1-payroll-extra"));
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(operator);
        treasury.releasePayment(alice, address(token), 2_000e6, keccak256("day2-payroll"));

        assertEq(token.balanceOf(alice), 12_000e6);
    }

    function test_PausingTreasury_BlocksAllReleases_RegardlessOfCompliance() public {
        _attest(alice, 3, keccak256("nexaid-report-alice"));

        vm.prank(owner);
        treasury.pause();

        vm.prank(operator);
        vm.expectRevert();
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-1-alice"));

        vm.prank(owner);
        treasury.unpause();

        vm.prank(operator);
        treasury.releasePayment(alice, address(token), 1_000e6, keccak256("payroll-run-1-alice"));
        assertEq(token.balanceOf(alice), 1_000e6);
    }
}
