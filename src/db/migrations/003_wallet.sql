-- Add encrypted private key storage for Telegram-generated wallets
-- In production this would use Privy server wallets; for demo purposes
-- we generate and store encrypted keys server-side
ALTER TABLE users ADD COLUMN wallet_private_key TEXT;
