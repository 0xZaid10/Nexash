// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayrollTreasury} from "../src/PayrollTreasury.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PayrollTreasuryTest is Test {
    PayrollTreasury treasury;
    AttestationRegistry registry;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address issuer = makeAddr("issuer");
    address payee = makeAddr("payee");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        vm.startPrank(owner);
        registry = new AttestationRegistry(owner);
        registry.registerIssuer(issuer, "Nexash Issuer");
        treasury = new PayrollTreasury(owner, address(registry), operator);
        vm.stopPrank();

        usdc = new MockUSDC();
        usdc.transfer(address(treasury), 100_000e6);

        vm.prank(operator);
        treasury.registerPayee(payee, KYC, 2, 1_000e6, 5_000e6);
    }

    function _attestPayee(uint8 level) internal {
        vm.prank(issuer);
        registry.recordAttestation(payee, KYC, keccak256("tx"), keccak256("task"), level, 0);
    }

    function test_ReleasePayment_RevertsWithoutAttestation() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRequirementNotMet.selector, payee, KYC));
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));
    }

    function test_ReleasePayment_SucceedsWithValidAttestation() public {
        _attestPayee(3);

        vm.prank(operator);
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));

        assertEq(usdc.balanceOf(payee), 500e6);
        assertTrue(treasury.isMandateSettled(keccak256("mandate-1")));
    }

    function test_ReleasePayment_RevertsOnInsufficientKycLevel() public {
        _attestPayee(1);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRequirementNotMet.selector, payee, KYC));
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));
    }

    function test_ReleasePayment_RevertsOnDuplicateMandate() public {
        _attestPayee(3);
        vm.prank(operator);
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.MandateAlreadySettled.selector, keccak256("mandate-1")));
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));
    }

    function test_ReleasePayment_RevertsOverPerPaymentLimit() public {
        _attestPayee(3);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.PerPaymentLimitExceeded.selector, 1_500e6, 1_000e6));
        treasury.releasePayment(payee, address(usdc), 1_500e6, keccak256("mandate-1"));
    }

    function test_ReleasePayment_RevertsOverDailyLimit() public {
        _attestPayee(3);
        // payee's dailyLimit is 5_000e6, perPaymentLimit is 1_000e6 (setUp).
        // Four payments of 1_000e6 = 4_000e6 spent, 1_000e6 remaining.
        vm.startPrank(operator);
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-1")); // running total: 1_000e6
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-2")); // running total: 2_000e6
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-3")); // running total: 3_000e6
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-4")); // running total: 4_000e6, remaining: 1_000e6

        // A 5th payment of exactly 1_000e6 should still succeed (remaining == amount).
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-5")); // running total: 5_000e6, remaining: 0

        // A 6th payment of any amount > 0 must now revert: remaining is 0.
        vm.expectRevert(abi.encodeWithSelector(Errors.DailyLimitExceeded.selector, 1_000e6, 0));
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-6"));
        vm.stopPrank();
    }

    function test_DailyLimit_ResetsAfterWindow() public {
        _attestPayee(3);
        vm.prank(operator);
        treasury.releasePayment(payee, address(usdc), 1_000e6, keccak256("mandate-1"));

        vm.warp(block.timestamp + 1 days + 1);

        assertEq(treasury.getRemainingDailyAllowance(payee), 5_000e6);
    }

    function test_OnlyOperator_CanReleasePayment() public {
        _attestPayee(3);
        vm.prank(payee);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotOperator.selector, payee));
        treasury.releasePayment(payee, address(usdc), 500e6, keccak256("mandate-1"));
    }
}
