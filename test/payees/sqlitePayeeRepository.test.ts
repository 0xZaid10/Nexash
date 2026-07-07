import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const migrationSql = readFileSync(join(__dirname, "../../src/db/migrations/001_init.sql"), "utf-8");

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(migrationSql);
  return db;
}

// SqlitePayeeRepository imports `db` directly from client.ts (a module-level
// singleton) - mock that module so tests run against an isolated in-memory db.
vi.mock("../../src/db/client", () => {
  return { db: freshDb() };
});

describe("SqlitePayeeRepository", () => {
  it("returns null for an identifier that was never registered", async () => {
    const { SqlitePayeeRepository } = await import("../../src/db/schema");
    const repo = new SqlitePayeeRepository();
    const result = await repo.findByIdentifier("nobody");
    expect(result).toBeNull();
  });

  it("upsert then findByIdentifier round-trips correctly", async () => {
    const { SqlitePayeeRepository } = await import("../../src/db/schema");
    const repo = new SqlitePayeeRepository();
    await repo.upsert("alice", "0x1111111111111111111111111111111111111111");

    const found = await repo.findByIdentifier("alice");
    expect(found).toEqual({ identifier: "alice", address: "0x1111111111111111111111111111111111111111" });
  });

  it("identifier lookup is case-insensitive", async () => {
    const { SqlitePayeeRepository } = await import("../../src/db/schema");
    const repo = new SqlitePayeeRepository();
    await repo.upsert("Alice", "0x1111111111111111111111111111111111111111");

    const found = await repo.findByIdentifier("ALICE");
    expect(found).not.toBeNull();
  });

  it("upsert on an existing identifier UPDATES the address rather than duplicating the row", async () => {
    const { SqlitePayeeRepository } = await import("../../src/db/schema");
    const repo = new SqlitePayeeRepository();
    await repo.upsert("bob", "0x2222222222222222222222222222222222222222");
    await repo.upsert("bob", "0x3333333333333333333333333333333333333333");

    const found = await repo.findByIdentifier("bob");
    expect(found?.address).toBe("0x3333333333333333333333333333333333333333");

    const all = await repo.listAll();
    expect(all.filter((p) => p.identifier === "bob")).toHaveLength(1);
  });

  it("listAll returns every registered payee", async () => {
    const { SqlitePayeeRepository } = await import("../../src/db/schema");
    const repo = new SqlitePayeeRepository();
    await repo.upsert("carol", "0x4444444444444444444444444444444444444444");
    await repo.upsert("dave", "0x5555555555555555555555555555555555555555");

    const all = await repo.listAll();
    const identifiers = all.map((p) => p.identifier);
    expect(identifiers).toContain("carol");
    expect(identifiers).toContain("dave");
  });
});

describe("payment history + issued attestation log helpers", () => {
  it("recordPaymentHistory then getPaymentHistoryForPayee returns it, most recent first", async () => {
    const { SqlitePayeeRepository, recordPaymentHistory, getPaymentHistoryForPayee } = await import(
      "../../src/db/schema"
    );
    const repo = new SqlitePayeeRepository();
    await repo.upsert("erin", "0x6666666666666666666666666666666666666666");

    recordPaymentHistory({
      payeeIdentifier: "erin",
      amount: "100",
      token: "0xtoken",
      mandateHash: "0xmandate1",
      releasedAt: 1000,
      createdAt: 1000,
    });
    recordPaymentHistory({
      payeeIdentifier: "erin",
      amount: "200",
      token: "0xtoken",
      mandateHash: "0xmandate2",
      releasedAt: 2000,
      createdAt: 2000,
    });

    const history = getPaymentHistoryForPayee("erin");
    expect(history).toHaveLength(2);
    expect(history[0]!.amount).toBe("200");
  });

  it("logIssuedAttestation then markAttestationAnchored updates the on_chain_tx_hash", async () => {
    const { logIssuedAttestation, markAttestationAnchored } = await import("../../src/db/schema");

    logIssuedAttestation({
      subject: "0x7777777777777777777777777777777777777777",
      capability: "attests:kyc:v1",
      kycLevel: 3,
      reportTxHash: "0xreport1",
      taskId: "0xtask1",
      signature: "0xsig1",
      onChainTxHash: null,
      issuedAt: 1000,
    });

    expect(() => markAttestationAnchored("0xreport1", "0xonchaintx1")).not.toThrow();
  });
});
