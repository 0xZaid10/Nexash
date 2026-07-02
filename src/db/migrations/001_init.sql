-- Nexash V2 initial schema.
--
-- DELIBERATE SCOPE NOTE: this database does NOT store payee policy
-- (requiredCapability, minKycLevel, perPaymentLimit, dailyLimit, active) -
-- that lives entirely on-chain in PayrollTreasury and is read live via
-- chain/payrollTreasuryClient.ts. This database exists ONLY for data that
-- structurally cannot live on-chain (an EVM mapping cannot be queried by an
-- arbitrary string key without already having the address) or that has no
-- on-chain counterpart at all (paper trading state, agent conversation
-- history). See payees/payeeService.ts's PayeeRepository comment and the
-- conversation decision to keep on-chain identity resolution as a future
-- (V3) scope item rather than adding a fourth contract now.

CREATE TABLE IF NOT EXISTS payee_directory (
  identifier      TEXT PRIMARY KEY,
  address         TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payee_directory_address ON payee_directory(address);

CREATE TABLE IF NOT EXISTS payee_payment_history (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  payee_identifier  TEXT NOT NULL REFERENCES payee_directory(identifier),
  amount            TEXT NOT NULL,
  token             TEXT NOT NULL,
  mandate_hash      TEXT NOT NULL,
  released_at       INTEGER,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_history_payee ON payee_payment_history(payee_identifier);

-- Paper trading has no on-chain settlement by design (see
-- agents/tradingAgent/paperPortfolio.ts) - this IS the source of truth for
-- simulated portfolios, not a cache of something stored elsewhere.
CREATE TABLE IF NOT EXISTS paper_portfolios (
  user_id               TEXT PRIMARY KEY,
  base_currency_balance REAL NOT NULL,
  realized_pnl          REAL NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL REFERENCES paper_portfolios(user_id),
  pair          TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  size          REAL NOT NULL,
  entry_price   REAL NOT NULL,
  opened_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_user ON paper_positions(user_id);

-- Tracks issued-but-not-yet-on-chain attestations, useful for auditing the
-- issuer's own activity independent of what made it into AttestationRegistry
-- (e.g. if recordAttestationOnChain fails after issuerService already
-- signed, this row is the only record that the signature was produced).
CREATE TABLE IF NOT EXISTS issued_attestations_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  subject           TEXT NOT NULL,
  capability        TEXT NOT NULL,
  kyc_level         INTEGER,
  report_tx_hash    TEXT NOT NULL,
  task_id           TEXT NOT NULL,
  signature         TEXT NOT NULL,
  on_chain_tx_hash  TEXT,
  issued_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issued_attestations_subject ON issued_attestations_log(subject);
