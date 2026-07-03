// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {IPayrollTreasury} from "./interfaces/IPayrollTreasury.sol";
import {IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";
import {CapabilityTypes} from "./libraries/CapabilityTypes.sol";
import {Errors} from "./libraries/Errors.sol";

contract PayrollTreasury is IPayrollTreasury, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IAttestationRegistry public immutable attestationRegistry;

    mapping(address payee => CapabilityTypes.PayeePolicy) private _policies;

    mapping(address payee => uint256 spentToday) private _spentToday;
    mapping(address payee => uint256 windowStart) private _windowStart;

    mapping(bytes32 mandateHash => bool settled) private _settledMandates;

    uint256 private constant DAY = 1 days;

    address public operator;

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner()) revert Errors.NotOperator(msg.sender);
        _;
    }

    constructor(
        address initialOwner,
        address registry,
        address initialOperator
    ) Ownable2Step() Ownable(initialOwner) {
        attestationRegistry = IAttestationRegistry(registry);
        operator = initialOperator;
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert Errors.ZeroAddress();
        operator = newOperator;
    }

    function deposit(address token, uint256 amount) external whenNotPaused {
        if (amount == 0) revert Errors.ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    function registerPayee(
        address payee,
        bytes32 requiredCapability,
        uint8 minKycLevel,
        uint256 perPaymentLimit,
        uint256 dailyLimit
    ) external onlyOperator {
        if (payee == address(0)) revert Errors.ZeroAddress();
        if (_policies[payee].payee != address(0)) revert Errors.PayeeAlreadyRegistered(payee);

        _policies[payee] = CapabilityTypes.PayeePolicy({
            payee: payee,
            requiredCapability: requiredCapability,
            minKycLevel: minKycLevel,
            perPaymentLimit: perPaymentLimit,
            dailyLimit: dailyLimit,
            active: true
        });

        emit PayeeRegistered(payee, requiredCapability, minKycLevel, perPaymentLimit, dailyLimit);
    }

    function updatePayee(
        address payee,
        uint256 perPaymentLimit,
        uint256 dailyLimit,
        bool active
    ) external onlyOperator {
        CapabilityTypes.PayeePolicy storage p = _policies[payee];
        if (p.payee == address(0)) revert Errors.PayeeNotRegistered(payee);

        p.perPaymentLimit = perPaymentLimit;
        p.dailyLimit = dailyLimit;
        p.active = active;

        emit PayeeUpdated(payee, perPaymentLimit, dailyLimit, active);
    }

    function deactivatePayee(address payee) external onlyOperator {
        CapabilityTypes.PayeePolicy storage p = _policies[payee];
        if (p.payee == address(0)) revert Errors.PayeeNotRegistered(payee);
        p.active = false;
        emit PayeeDeactivated(payee);
    }

    function releasePayment(
        address payee,
        address token,
        uint256 amount,
        bytes32 mandateHash
    ) external onlyOperator whenNotPaused nonReentrant {
        if (amount == 0) revert Errors.ZeroAmount();
        if (_settledMandates[mandateHash]) revert Errors.MandateAlreadySettled(mandateHash);

        CapabilityTypes.PayeePolicy storage p = _policies[payee];
        if (p.payee == address(0)) revert Errors.PayeeNotRegistered(payee);
        if (!p.active) revert Errors.PayeeInactive(payee);

        if (
            !attestationRegistry.isValidWithMinLevel(payee, p.requiredCapability, p.minKycLevel)
        ) {
            revert Errors.ComplianceRequirementNotMet(payee, p.requiredCapability);
        }

        if (amount > p.perPaymentLimit) {
            revert Errors.PerPaymentLimitExceeded(amount, p.perPaymentLimit);
        }

        _rollDailyWindow(payee);
        uint256 remaining = p.dailyLimit - _spentToday[payee];
        if (amount > remaining) {
            revert Errors.DailyLimitExceeded(amount, remaining);
        }

        uint256 available = IERC20(token).balanceOf(address(this));
        if (amount > available) {
            revert Errors.InsufficientTreasuryBalance(amount, available);
        }

        _spentToday[payee] += amount;
        _settledMandates[mandateHash] = true;

        IERC20(token).safeTransfer(payee, amount);

        emit PaymentReleased(payee, token, amount, mandateHash);
    }

    function _rollDailyWindow(address payee) private {
        if (block.timestamp >= _windowStart[payee] + DAY) {
            _windowStart[payee] = block.timestamp;
            _spentToday[payee] = 0;
        }
    }

    function getPayeePolicy(
        address payee
    ) external view returns (CapabilityTypes.PayeePolicy memory) {
        return _policies[payee];
    }

    function getRemainingDailyAllowance(address payee) external view returns (uint256) {
        CapabilityTypes.PayeePolicy storage p = _policies[payee];
        if (block.timestamp >= _windowStart[payee] + DAY) {
            return p.dailyLimit;
        }
        return p.dailyLimit - _spentToday[payee];
    }

    function isMandateSettled(bytes32 mandateHash) external view returns (bool) {
        return _settledMandates[mandateHash];
    }

    function balanceOf(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
