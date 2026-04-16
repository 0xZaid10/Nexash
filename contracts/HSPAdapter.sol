// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title HSPAdapter
/// @notice On-chain representation of the HSP (HashKey Settlement Protocol) payment state machine
/// @dev Mirrors the HSP payment states from the merchant API docs:
///      payment-required → payment-submitted → payment-verified →
///      payment-processing → payment-included → payment-successful / payment-failed
contract HSPAdapter {

    // ─── Types ────────────────────────────────────────────
    enum PaymentState {
        NONE,               // 0 — not created
        PAYMENT_REQUIRED,   // 1 — cart mandate created, awaiting payer
        PAYMENT_SUBMITTED,  // 2 — authorization submitted by payer
        PAYMENT_VERIFIED,   // 3 — authorization verified
        PAYMENT_PROCESSING, // 4 — on-chain transaction in flight
        PAYMENT_INCLUDED,   // 5 — included in block, confirmations pending
        PAYMENT_SUCCESSFUL, // 6 — terminal: success
        PAYMENT_FAILED      // 7 — terminal: failure
    }

    struct CartMandate {
        bytes32   cartMandateId;        // ID1 — order identifier
        bytes32   paymentRequestId;     // ID2 — payment request id
        address   treasury;             // treasury initiating the payment
        address   token;                // USDC/USDT contract address
        address   payTo;                // recipient address
        uint256   amount;               // amount in token base units
        uint256   cartExpiry;           // unix timestamp expiry
        string    merchantName;         // display name
        PaymentState state;             // current state
        uint256   createdAt;            // creation timestamp
        uint256   updatedAt;            // last update timestamp
        bytes32   txHash;               // on-chain tx hash when available
        string    statusReason;         // failure reason if failed
    }

    // ─── State ────────────────────────────────────────────
    // paymentRequestId => CartMandate
    mapping(bytes32 => CartMandate) public mandates;

    // treasury => paymentRequestId[]
    mapping(address => bytes32[]) public treasuryPayments;

    // ─── Events ───────────────────────────────────────────
    event MandateCreated(
        bytes32 indexed cartMandateId,
        bytes32 indexed paymentRequestId,
        address indexed treasury,
        address token,
        address payTo,
        uint256 amount,
        uint256 cartExpiry
    );

    event StateTransitioned(
        bytes32 indexed paymentRequestId,
        PaymentState   fromState,
        PaymentState   toState,
        uint256        timestamp
    );

    event PaymentSuccessful(
        bytes32 indexed paymentRequestId,
        bytes32         txHash,
        uint256         completedAt
    );

    event PaymentFailed(
        bytes32 indexed paymentRequestId,
        string          reason
    );

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyTreasury(bytes32 paymentRequestId) {
        require(
            mandates[paymentRequestId].treasury == msg.sender,
            "HSPAdapter: not the treasury"
        );
        _;
    }

    modifier notExpired(bytes32 paymentRequestId) {
        require(
            block.timestamp <= mandates[paymentRequestId].cartExpiry,
            "HSPAdapter: cart mandate expired"
        );
        _;
    }

    modifier inState(bytes32 paymentRequestId, PaymentState expected) {
        require(
            mandates[paymentRequestId].state == expected,
            "HSPAdapter: invalid state transition"
        );
        _;
    }

    // ─── Core Functions ───────────────────────────────────

    /// @notice Create a new Cart Mandate (mirrors POST /merchant/orders)
    /// @dev Called by ZKTreasury when initiating a payment
    function createMandate(
        bytes32 cartMandateId,
        bytes32 paymentRequestId,
        address token,
        address payTo,
        uint256 amount,
        uint256 cartExpiry,
        string calldata merchantName
    ) external {
        require(cartMandateId    != bytes32(0), "HSPAdapter: zero cartMandateId");
        require(paymentRequestId != bytes32(0), "HSPAdapter: zero paymentRequestId");
        require(token            != address(0), "HSPAdapter: zero token");
        require(payTo            != address(0), "HSPAdapter: zero payTo");
        require(amount           > 0,           "HSPAdapter: zero amount");
        require(cartExpiry       > block.timestamp, "HSPAdapter: already expired");
        require(
            mandates[paymentRequestId].state == PaymentState.NONE,
            "HSPAdapter: mandate already exists"
        );

        mandates[paymentRequestId] = CartMandate({
            cartMandateId:    cartMandateId,
            paymentRequestId: paymentRequestId,
            treasury:         msg.sender,
            token:            token,
            payTo:            payTo,
            amount:           amount,
            cartExpiry:       cartExpiry,
            merchantName:     merchantName,
            state:            PaymentState.PAYMENT_REQUIRED,
            createdAt:        block.timestamp,
            updatedAt:        block.timestamp,
            txHash:           bytes32(0),
            statusReason:     ""
        });

        treasuryPayments[msg.sender].push(paymentRequestId);

        emit MandateCreated(
            cartMandateId,
            paymentRequestId,
            msg.sender,
            token,
            payTo,
            amount,
            cartExpiry
        );
    }

    /// @notice Advance state to PAYMENT_SUBMITTED
    function submitPayment(bytes32 paymentRequestId)
        external
        onlyTreasury(paymentRequestId)
        notExpired(paymentRequestId)
        inState(paymentRequestId, PaymentState.PAYMENT_REQUIRED)
    {
        _transition(paymentRequestId, PaymentState.PAYMENT_SUBMITTED);
    }

    /// @notice Advance state to PAYMENT_VERIFIED
    function verifyPayment(bytes32 paymentRequestId)
        external
        onlyTreasury(paymentRequestId)
        notExpired(paymentRequestId)
        inState(paymentRequestId, PaymentState.PAYMENT_SUBMITTED)
    {
        _transition(paymentRequestId, PaymentState.PAYMENT_VERIFIED);
    }

    /// @notice Advance state to PAYMENT_PROCESSING with tx hash
    function processPayment(bytes32 paymentRequestId, bytes32 txHash)
        external
        onlyTreasury(paymentRequestId)
        notExpired(paymentRequestId)
        inState(paymentRequestId, PaymentState.PAYMENT_VERIFIED)
    {
        mandates[paymentRequestId].txHash = txHash;
        _transition(paymentRequestId, PaymentState.PAYMENT_PROCESSING);
    }

    /// @notice Advance state to PAYMENT_INCLUDED (in block)
    function markIncluded(bytes32 paymentRequestId)
        external
        onlyTreasury(paymentRequestId)
        inState(paymentRequestId, PaymentState.PAYMENT_PROCESSING)
    {
        _transition(paymentRequestId, PaymentState.PAYMENT_INCLUDED);
    }

    /// @notice Mark payment as successful (terminal state)
    function markSuccessful(bytes32 paymentRequestId)
        external
        onlyTreasury(paymentRequestId)
        inState(paymentRequestId, PaymentState.PAYMENT_INCLUDED)
    {
        _transition(paymentRequestId, PaymentState.PAYMENT_SUCCESSFUL);
        emit PaymentSuccessful(
            paymentRequestId,
            mandates[paymentRequestId].txHash,
            block.timestamp
        );
    }

    /// @notice Mark payment as failed (terminal state)
    function markFailed(bytes32 paymentRequestId, string calldata reason)
        external
        onlyTreasury(paymentRequestId)
    {
        PaymentState current = mandates[paymentRequestId].state;
        require(
            current != PaymentState.NONE &&
            current != PaymentState.PAYMENT_SUCCESSFUL &&
            current != PaymentState.PAYMENT_FAILED,
            "HSPAdapter: cannot fail from current state"
        );

        mandates[paymentRequestId].statusReason = reason;
        _transition(paymentRequestId, PaymentState.PAYMENT_FAILED);
        emit PaymentFailed(paymentRequestId, reason);
    }

    // ─── View Functions ───────────────────────────────────

    function getMandate(bytes32 paymentRequestId) external view returns (CartMandate memory) {
        return mandates[paymentRequestId];
    }

    function getState(bytes32 paymentRequestId) external view returns (PaymentState) {
        return mandates[paymentRequestId].state;
    }

    function getTreasuryPayments(address treasury) external view returns (bytes32[] memory) {
        return treasuryPayments[treasury];
    }

    function isTerminal(bytes32 paymentRequestId) external view returns (bool) {
        PaymentState s = mandates[paymentRequestId].state;
        return s == PaymentState.PAYMENT_SUCCESSFUL || s == PaymentState.PAYMENT_FAILED;
    }

    function isExpired(bytes32 paymentRequestId) external view returns (bool) {
        return block.timestamp > mandates[paymentRequestId].cartExpiry;
    }

    // ─── Internal ─────────────────────────────────────────
    function _transition(bytes32 paymentRequestId, PaymentState newState) internal {
        PaymentState oldState = mandates[paymentRequestId].state;
        mandates[paymentRequestId].state     = newState;
        mandates[paymentRequestId].updatedAt = block.timestamp;
        emit StateTransitioned(paymentRequestId, oldState, newState, block.timestamp);
    }
}
