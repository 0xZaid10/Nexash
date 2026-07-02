import { randomUUID, randomBytes } from "crypto";
import { db } from "./client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface User {
  id: string;
  telegramId: string | null;
  telegramHandle: string | null;
  privyUserId: string | null;
  walletAddress: string | null;
  createdAt: number;
  updatedAt: number;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    telegramId: (row.telegram_id as string) ?? null,
    telegramHandle: (row.telegram_handle as string) ?? null,
    privyUserId: (row.privy_user_id as string) ?? null,
    walletAddress: (row.wallet_address as string) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function findUserByTelegramId(telegramId: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserByPrivyId(privyUserId: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE privy_user_id = ?").get(privyUserId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserByWallet(walletAddress: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(walletAddress.toLowerCase()) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserById(id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function getOrCreateUserByTelegram(telegramId: string, telegramHandle?: string): User {
  const existing = findUserByTelegramId(telegramId);
  if (existing) {
    if (telegramHandle && existing.telegramHandle !== telegramHandle) {
      db.prepare("UPDATE users SET telegram_handle = ?, updated_at = ? WHERE id = ?").run(
        telegramHandle,
        Math.floor(Date.now() / 1000),
        existing.id
      );
      existing.telegramHandle = telegramHandle;
    }
    return existing;
  }

  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, telegram_id, telegram_handle, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, telegramId, telegramHandle ?? null, now, now);

  return findUserById(id)!;
}

export function createWalletForUser(userId: string): { address: string; privateKey: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const address = account.address.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("UPDATE users SET wallet_address = ?, wallet_private_key = ?, updated_at = ? WHERE id = ?")
    .run(address, privateKey, now, userId);
  return { address: account.address, privateKey };
}

export function getUserWallet(userId: string): { address: string; privateKey: string } | null {
  const row = db.prepare("SELECT wallet_address, wallet_private_key FROM users WHERE id = ?").get(userId) as
    | { wallet_address: string; wallet_private_key: string }
    | undefined;
  if (!row?.wallet_address || !row?.wallet_private_key) return null;
  return { address: row.wallet_address, privateKey: row.wallet_private_key };
}

export function linkPrivyToUser(userId: string, privyUserId: string, walletAddress?: string): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare("UPDATE users SET privy_user_id = ?, wallet_address = ?, updated_at = ? WHERE id = ?").run(
    privyUserId,
    walletAddress?.toLowerCase() ?? null,
    now,
    userId
  );
}

const LINK_TOKEN_EXPIRY_SECONDS = 15 * 60;

export function createLinkToken(userId: string): string {
  const token = randomBytes(24).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    "INSERT INTO link_tokens (token, user_id, used, created_at, expires_at) VALUES (?, ?, 0, ?, ?)"
  ).run(token, userId, now, now + LINK_TOKEN_EXPIRY_SECONDS);
  return token;
}

export function consumeLinkToken(token: string): User | null {
  const now = Math.floor(Date.now() / 1000);
  const row = db
    .prepare("SELECT * FROM link_tokens WHERE token = ? AND used = 0 AND expires_at > ?")
    .get(token, now) as Record<string, unknown> | undefined;

  if (!row) return null;

  db.prepare("UPDATE link_tokens SET used = 1 WHERE token = ?").run(token);
  return findUserById(row.user_id as string);
}
