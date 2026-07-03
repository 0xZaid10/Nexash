// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayrollTreasury} from "../../src/PayrollTreasury.sol";
import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

contract FuzzUSDC is ERC20 {
    constructor() ERC20("Fuzz USDC", "fUSDC") {
        _mint(msg.sender, type(uint128).max);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PayrollTreasuryFuzzTest is Test {
    PayrollTreasury treasury;
    AttestationRegistry registry;
    FuzzUSDC token;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address issuer = makeAddr("issuer");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        vm.startPrank(owner);
        registry = new AttestationRegistry(owner);
        registry.registerIssuer(issuer, "Fuzz Issuer");
        treasury = new PayrollTreasury(owner, address(registry), operator);
        vm.stopPrank();

        token = new FuzzUSDC();
        token.transfer(address(treasury), type(uint128).max / 2);
    }

    /// @dev No matter the randomized perPaymentLimit / dailyLimit / amount,
    ///      a payment must NEVER succeed if it exceeds either limit, and
    ///      must NEVER succeed without a valid attestation at the required level.
    function testFuzz_ReleasePayment_NeverExceedsConfiguredLimits(
        uint96 perPaymentLimit,
        uint96 dailyLimit,
        uint96 amount,
        uint8 kycLevel,
        uint8 minKycLevel
    ) public {
        perPaymentLimit = uint96(bound(perPaymentLimit, 1, type(uint96).max));
        dailyLimit = uint96(bound(dailyLimit, 1, type(uint96).max));
        amount = uint96(bound(amount, 1, type(uint96).max));

        address payee = makeAddr(string(abi.encodePacked("payee", amount, kycLevel)));

        vm.prank(operator);
        treasury.registerPayee(payee, KYC, minKycLevel, perPaymentLimit, dailyLimit);

        vm.prank(issuer);
        registry.recordAttestation(payee, KYC, keccak256("tx"), keccak256("task"), kycLevel, 0);

        uint256 balanceBefore = token.balanceOf(payee);

        bool shouldSucceed = kycLevel >= minKycLevel
            && amount <= perPaymentLimit
            && amount <= dailyLimit
            && amount <= token.balanceOf(address(treasury));

        vm.prank(operator);
        if (shouldSucceed) {
            treasury.releasePayment(payee, address(token), amount, keccak256(abi.encode(payee, amount, "1")));
            assertEq(token.balanceOf(payee), balanceBefore + amount);
        } else {
            vm.expectRevert();
            treasury.releasePayment(payee, address(token), amount, keccak256(abi.encode(payee, amount, "1")));
            assertEq(token.balanceOf(payee), balanceBefore);
        }
    }

    /// @dev Regardless of how many randomized payments are released across a
    ///      single day, cumulative spend for a payee must never exceed dailyLimit.
    function testFuzz_CumulativeDailySpend_NeverExceedsLimit(
        uint64 dailyLimit,
        uint8 numPayments,
        uint64 seed
    ) public {
        dailyLimit = uint64(bound(dailyLimit, 1e6, 1_000_000e6));
        numPayments = uint8(bound(numPayments, 1, 20));

        address payee = makeAddr(string(abi.encodePacked("fuzzpayee", seed)));

        vm.prank(operator);
        treasury.registerPayee(payee, KYC, 0, type(uint96).max, dailyLimit);

        vm.prank(issuer);
        registry.recordAttestation(payee, KYC, keccak256("tx"), keccak256("task"), 4, 0);

        uint256 totalSpent = 0;

        for (uint8 i = 0; i < numPayments; i++) {
            uint256 amount = uint256(keccak256(abi.encode(seed, i))) % (dailyLimit / 2 + 1) + 1;

            vm.prank(operator);
            try treasury.releasePayment(payee, address(token), amount, keccak256(abi.encode(seed, i, "p"))) {
                totalSpent += amount;
                assertLe(totalSpent, dailyLimit, "cumulative spend exceeded dailyLimit");
            } catch {
                // expected once the limit is reached - not a failure
            }
        }

        assertLe(token.balanceOf(payee), dailyLimit, "payee balance exceeded dailyLimit in a single window");
    }

    /// @dev A mandateHash, once settled, must NEVER be settleable again,
    ///      regardless of which payee/token/amount combination is tried.
    function testFuzz_MandateHash_NeverDoubleSettles(bytes32 mandateHash, uint96 amount) public {
        amount = uint96(bound(amount, 1, 1_000_000e6));
        address payee = makeAddr("doubleSettlePayee");

        vm.prank(operator);
        treasury.registerPayee(payee, KYC, 0, type(uint96).max, type(uint96).max);

        vm.prank(issuer);
        registry.recordAttestation(payee, KYC, keccak256("tx"), keccak256("task"), 4, 0);

        vm.prank(operator);
        treasury.releasePayment(payee, address(token), amount, mandateHash);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Errors.MandateAlreadySettled.selector, mandateHash));
        treasury.releasePayment(payee, address(token), amount, mandateHash);
    }
}
