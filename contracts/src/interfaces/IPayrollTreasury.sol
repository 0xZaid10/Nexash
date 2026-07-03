// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {CapabilityTypes} from "../libraries/CapabilityTypes.sol";

interface IPayrollTreasury {
    event Deposited(address indexed token, address indexed from, uint256 amount);

    event PayeeRegistered(
        address indexed payee,
        bytes32 requiredCapability,
        uint8 minKycLevel,
        uint256 perPaymentLimit,
        uint256 dailyLimit
    );

    event PayeeUpdated(
        address indexed payee,
        uint256 perPaymentLimit,
        uint256 dailyLimit,
        bool active
    );

    event PayeeDeactivated(address indexed payee);

    event PaymentReleased(
        address indexed payee,
        address indexed token,
        uint256 amount,
        bytes32 indexed mandateHash
    );

    function deposit(address token, uint256 amount) external;

    function registerPayee(
        address payee,
        bytes32 requiredCapability,
        uint8 minKycLevel,
        uint256 perPaymentLimit,
        uint256 dailyLimit
    ) external;

    function updatePayee(
        address payee,
        uint256 perPaymentLimit,
        uint256 dailyLimit,
        bool active
    ) external;

    function deactivatePayee(address payee) external;

    function releasePayment(
        address payee,
        address token,
        uint256 amount,
        bytes32 mandateHash
    ) external;

    function getPayeePolicy(address payee) external view returns (CapabilityTypes.PayeePolicy memory);

    function getRemainingDailyAllowance(address payee) external view returns (uint256);

    function isMandateSettled(bytes32 mandateHash) external view returns (bool);

    function balanceOf(address token) external view returns (uint256);
}
