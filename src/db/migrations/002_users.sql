CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  telegram_id     TEXT UNIQUE,
  telegram_handle TEXT,
  privy_user_id   TEXT UNIQUE,
  wallet_address  TEXT UNIQUE,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

CREATE TABLE IF NOT EXISTS link_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_tokens_user_id ON link_tokens(user_id);
