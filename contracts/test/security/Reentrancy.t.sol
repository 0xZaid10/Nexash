// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayrollTreasury} from "../../src/PayrollTreasury.sol";
import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

/// @notice A malicious ERC-20 whose transfer() callback attempts to
///         re-enter PayrollTreasury.releasePayment() using the SAME
///         mandateHash before the original call has finished updating
///         state. If ReentrancyGuard is doing its job, the re-entrant
///         call must revert. If it is NOT doing its job, this token would
///         be able to drain the treasury by re-entering before
///         _settledMandates[mandateHash] is set to true.
contract ReentrantToken is ERC20 {
    PayrollTreasury public target;
    address public attacker;
    bytes32 public mandateHash;
    bool public attackArmed;
    bool public reentrancyReverted;

    constructor() ERC20("Reentrant Token", "REENT") {
        _mint(msg.sender, 1_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function arm(PayrollTreasury _target, address _attacker, bytes32 _mandateHash) external {
        target = _target;
        attacker = _attacker;
        mandateHash = _mandateHash;
        attackArmed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool success = super.transfer(to, amount);

        if (attackArmed && to == attacker) {
            attackArmed = false; // disarm so we only attempt the re-entry once
            try target.releasePayment(attacker, address(this), amount, mandateHash) {
                // if this succeeds, the guard FAILED to stop re-entrancy
            } catch {
                reentrancyReverted = true;
            }
        }

        return success;
    }
}

contract ReentrancyAttackTest is Test {
    PayrollTreasury treasury;
    AttestationRegistry registry;
    ReentrantToken token;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address issuer = makeAddr("issuer");
    address attacker = makeAddr("attacker");

    bytes32 constant KYC = keccak256("attests:kyc:v1");

    function setUp() public {
        vm.startPrank(owner);
        registry = new AttestationRegistry(owner);
        registry.registerIssuer(issuer, "Issuer");
        treasury = new PayrollTreasury(owner, address(registry), operator);
        vm.stopPrank();

        token = new ReentrantToken();
        token.transfer(address(treasury), 500_000e6);

        vm.prank(operator);
        treasury.registerPayee(attacker, KYC, 0, 100_000e6, 100_000e6);

        vm.prank(issuer);
        registry.recordAttestation(attacker, KYC, keccak256("tx"), keccak256("task"), 4, 0);
    }

    /// @dev Same-mandateHash reentrancy: this is caught by checks-effects-
    ///      interactions ordering (_settledMandates is set before the
    ///      transfer) even without ReentrancyGuard. This test proves that
    ///      defense-in-depth layer works - it does NOT in isolation prove
    ///      the guard itself is doing anything (see the second test below
    ///      for that). Both protections being intact is what we want.
    function test_ReentrancyGuard_BlocksReentrantReleasePayment() public {
        bytes32 mandateHash = keccak256("attack-mandate");
        token.arm(treasury, attacker, mandateHash);

        uint256 treasuryBalanceBefore = token.balanceOf(address(treasury));

        vm.prank(operator);
        treasury.releasePayment(attacker, address(token), 1_000e6, mandateHash);

        assertTrue(token.reentrancyReverted(), "re-entrant call should have reverted but did not");

        // Exactly one payment's worth should have left the treasury, not two.
        assertEq(
            token.balanceOf(address(treasury)),
            treasuryBalanceBefore - 1_000e6,
            "treasury lost more than one payment - reentrancy guard failed"
        );

        assertTrue(treasury.isMandateSettled(mandateHash));
    }

    /// @dev Even with a DIFFERENT mandateHash (so the duplicate-mandate
    ///      check alone wouldn't save us) AND a re-entrant amount small
    ///      enough that the daily limit wouldn't incidentally block it
    ///      either, the reentrancy guard must still be the thing that
    ///      blocks the nested call - isolating its actual contribution
    ///      rather than relying on the other checks to coincidentally catch it.
    function test_ReentrancyGuard_BlocksEvenWithDifferentMandateHash() public {
        bytes32 mandateHash1 = keccak256("attack-mandate-1");
        bytes32 mandateHash2 = keccak256("attack-mandate-2");

        // attacker's perPaymentLimit/dailyLimit are 100_000e6 (setUp).
        // Outer call spends only 1_000e6, leaving 99_000e6 of headroom -
        // far more than the re-entrant call's 1_000e6, so if the re-entrant
        // call is blocked, it is NOT because of the daily limit.
        token.arm(treasury, attacker, mandateHash2);

        vm.prank(operator);
        treasury.releasePayment(attacker, address(token), 1_000e6, mandateHash1);

        assertTrue(token.reentrancyReverted(), "re-entrant call with different mandateHash was not blocked");
        assertFalse(treasury.isMandateSettled(mandateHash2), "second mandate should never have settled");

        // Confirm headroom truly existed - if this assertion fails, the
        // test above would have been ambiguous (limit vs guard).
        assertGe(
            treasury.getRemainingDailyAllowance(attacker),
            1_000e6,
            "test setup invalid: daily limit alone could explain the revert"
        );
    }
}

