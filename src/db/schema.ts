import { db } from "./client";
import type { PayeeRepository } from "../payees/payeeService";

/**
 * The real, persistent implementation of PayeeRepository - replaces
 * payeeService.ts's InMemoryPayeeRepository placeholder. Swapping this in
 * means changing exactly one line in payeeService.ts (the
 * `payeeRepository` instantiation), since both implementations satisfy the
 * same interface.
 */
export class SqlitePayeeRepository implements PayeeRepository {
  async findByIdentifier(
    identifier: string
  ): Promise<{ identifier: string; address: `0x${string}` } | null> {
    const row = db
      .prepare("SELECT identifier, address FROM payee_directory WHERE identifier = ?")
      .get(identifier.toLowerCase()) as { identifier: string; address: string } | undefined;

    return row ? { identifier: row.identifier, address: row.address as `0x${string}` } : null;
  }

  async upsert(identifier: string, address: `0x${string}`): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO payee_directory (identifier, address, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(identifier) DO UPDATE SET address = excluded.address, updated_at = excluded.updated_at`
    ).run(identifier.toLowerCase(), address, now, now);
  }

  async listAll(): Promise<{ identifier: string; address: `0x${string}` }[]> {
    const rows = db.prepare("SELECT identifier, address FROM payee_directory").all() as {
      identifier: string;
      address: string;
    }[];
    return rows.map((r) => ({ identifier: r.identifier, address: r.address as `0x${string}` }));
  }

  async delete(identifier: string): Promise<void> {
    db.prepare("DELETE FROM payee_directory WHERE identifier = ?").run(identifier.toLowerCase());
  }
}

export interface PaymentHistoryRow {
  payeeIdentifier: string;
  amount: string;
  token: string;
  mandateHash: string;
  releasedAt: number | null;
}

/**
 * Feeds agents/paymentsAgent/anomalyReview.ts's PayeeHistoryEntry - the
 * anomaly reviewer needs real history to compare against, not a guess.
 */
export function recordPaymentHistory(params: PaymentHistoryRow & { createdAt: number }): void {
  db.prepare(
    `INSERT INTO payee_payment_history
     (payee_identifier, amount, token, mandate_hash, released_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    params.payeeIdentifier,
    params.amount,
    params.token,
    params.mandateHash,
    params.releasedAt,
    params.createdAt
  );
}

export function getPaymentHistoryForPayee(identifier: string, limit = 20): PaymentHistoryRow[] {
  const rows = db
    .prepare(
      `SELECT payee_identifier as payeeIdentifier, amount, token, mandate_hash as mandateHash, released_at as releasedAt
       FROM payee_payment_history
       WHERE payee_identifier = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(identifier.toLowerCase(), limit) as PaymentHistoryRow[];

  return rows;
}

export interface IssuedAttestationLogRow {
  subject: string;
  capability: string;
  kycLevel: number | null;
  reportTxHash: string;
  taskId: string;
  signature: string;
  onChainTxHash: string | null;
  issuedAt: number;
}

/**
 * Logs an issued attestation regardless of whether the on-chain anchor
 * (recordAttestationOnChain) has succeeded yet - if that call fails after
 * issuerService already produced a signature, this row is the only durable
 * record that the signature exists and what it covers.
 */
export function logIssuedAttestation(row: IssuedAttestationLogRow): void {
  db.prepare(
    `INSERT INTO issued_attestations_log
     (subject, capability, kyc_level, report_tx_hash, task_id, signature, on_chain_tx_hash, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.subject,
    row.capability,
    row.kycLevel,
    row.reportTxHash,
    row.taskId,
    row.signature,
    row.onChainTxHash,
    row.issuedAt
  );
}

export function markAttestationAnchored(reportTxHash: string, onChainTxHash: string): void {
  db.prepare(
    `UPDATE issued_attestations_log SET on_chain_tx_hash = ? WHERE report_tx_hash = ? AND on_chain_tx_hash IS NULL`
  ).run(onChainTxHash, reportTxHash);
}
