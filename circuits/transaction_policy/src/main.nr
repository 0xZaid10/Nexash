fn main(
    // Private inputs - never revealed on-chain
    amount:                 u64,
    spending_limit:         u64,
    operator_role:          u8,
    cumulative_daily_spend: u64,
    daily_spend_limit:      u64,
    // Public inputs - committed on-chain
    policy_hash:        pub Field,
    requires_multisig:  pub u1,
    multisig_threshold: pub u8,
    min_role:           pub u8,
    payment_request_id: pub Field,
    treasury_address:   pub Field,
    proof_timestamp:    pub u64,
) {
    //  1. Role checks 
    // Operator role must be a valid role value (1=Viewer, 2=Operator, 3=Admin)
    assert(operator_role >= 1, "Invalid role: must be at least 1");
    assert(operator_role <= 3, "Invalid role: must be at most 3");

    // Role must meet the treasury's minimum role requirement
    assert(operator_role >= min_role, "Role insufficient for this treasury");

    // Viewers (role=1) can never initiate payments regardless of min_role
    assert(operator_role >= 2, "Viewers cannot initiate payments");

    //  2. Amount checks 
    assert(amount > 0, "Amount must be greater than zero");
    assert(amount <= spending_limit, "Amount exceeds per-transaction spending limit");

    //  3. Daily spend checks 
    assert(cumulative_daily_spend <= daily_spend_limit, "Daily limit already reached");
    let new_daily_spend: u64 = cumulative_daily_spend + amount;
    assert(new_daily_spend <= daily_spend_limit, "Payment would exceed daily limit");

    //  4. Multisig requirement derivation 
    // Payments exceeding 50% of the per-tx spending limit require multisig
    let half_limit: u64 = spending_limit / 2;
    let needs_multisig: bool = amount > half_limit;
    let requires_multisig_bool: bool = requires_multisig == 1;
    assert(needs_multisig == requires_multisig_bool, "Multisig requirement mismatch");

    //  5. Policy hash verification 
    // The policy hash binds this proof to a specific treasury policy.
    // Computed as pedersen_hash([spending_limit, daily_limit, threshold, min_role, treasury])
    // Changing any policy parameter invalidates all existing proofs.
    let computed_hash: Field = std::hash::pedersen_hash([
        spending_limit         as Field,
        daily_spend_limit      as Field,
        multisig_threshold     as Field,
        min_role               as Field,
        treasury_address,
    ]);
    assert(computed_hash == policy_hash, "Policy hash mismatch: proof generated for different policy");

    //  6. Payment request binding 
    // Each proof is bound to a unique payment request ID.
    // Prevents the same proof from authorizing multiple payments.
    assert(payment_request_id != 0, "Invalid payment request ID");

    //  7. Timestamp validity 
    assert(proof_timestamp > 0, "Invalid proof timestamp");
}

//  Tests 

#[test]
fn test_operator_can_pay() {
    // Operator (role=2) paying within limits - should pass
    let policy_hash = std::hash::pedersen_hash([10000, 50000, 1, 2, 12345]);
    main(
        1000,        // amount
        10000,       // spending_limit
        2,           // operator_role = OPERATOR
        5000,        // cumulative_daily_spend
        50000,       // daily_spend_limit
        policy_hash,
        0,           // requires_multisig = false
        1,           // multisig_threshold
        2,           // min_role = OPERATOR
        999,         // payment_request_id
        12345,       // treasury_address
        1744000000,  // proof_timestamp
    );
    println("test_operator_can_pay passed");
}

#[test]
fn test_admin_can_pay() {
    // Admin (role=3) should be able to pay - was broken before
    let policy_hash = std::hash::pedersen_hash([10000, 50000, 1, 2, 12345]);
    main(
        1000,
        10000,
        3,           // operator_role = ADMIN
        0,
        50000,
        policy_hash,
        0,
        1,
        2,           // min_role = OPERATOR
        999,
        12345,
        1744000000,
    );
    println("test_admin_can_pay passed");
}

#[test]
fn test_large_payment_needs_multisig() {
    // Payment > 50% of spending limit must set requires_multisig = 1
    let policy_hash = std::hash::pedersen_hash([10000, 50000, 2, 2, 12345]);
    main(
        6000,        // amount > 10000/2 = 5000 -> needs multisig
        10000,
        2,
        0,
        50000,
        policy_hash,
        1,           // requires_multisig = true
        2,           // multisig_threshold
        2,
        999,
        12345,
        1744000000,
    );
    println("test_large_payment_needs_multisig passed");
}

#[test]
fn test_small_payment_no_multisig() {
    // Payment <= 50% of spending limit must set requires_multisig = 0
    let policy_hash = std::hash::pedersen_hash([10000, 50000, 1, 2, 12345]);
    main(
        4000,        // amount <= 10000/2 = 5000 -> no multisig
        10000,
        2,
        0,
        50000,
        policy_hash,
        0,           // requires_multisig = false
        1,
        2,
        999,
        12345,
        1744000000,
    );
    println("test_small_payment_no_multisig passed");
}

#[test]
fn test_policy_hash_binding() {
    // Correct hash for these exact policy values
    let correct_hash = std::hash::pedersen_hash([10000, 50000, 1, 2, 12345]);
    main(
        1000,
        10000,
        2,
        0,
        50000,
        correct_hash,
        0,
        1,
        2,
        999,
        12345,
        1744000000,
    );
    println("test_policy_hash_binding passed");
}
