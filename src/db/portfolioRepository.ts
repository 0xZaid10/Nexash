import { db } from "./client";

const STARTING_BALANCE = 10_000;

interface PaperPosition {
  pair: string;
  side: "buy" | "sell";
  size: number;
  entryPrice: number;
  openedAt: number;
}

interface PaperPortfolio {
  userId: string;
  baseCurrencyBalance: number;
  realizedPnl: number;
  positions: PaperPosition[];
}

export function loadPortfolio(userId: string): PaperPortfolio {
  const row = db.prepare("SELECT * FROM paper_portfolios WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      "INSERT OR IGNORE INTO paper_portfolios (user_id, base_currency_balance, realized_pnl, created_at, updated_at) VALUES (?, ?, 0, ?, ?)"
    ).run(userId, STARTING_BALANCE, now, now);
    return { userId, baseCurrencyBalance: STARTING_BALANCE, positions: [], realizedPnl: 0 };
  }

  const positions = db
    .prepare("SELECT * FROM paper_positions WHERE user_id = ? ORDER BY opened_at ASC")
    .all(userId) as Record<string, unknown>[];

  return {
    userId,
    baseCurrencyBalance: row.base_currency_balance as number,
    realizedPnl: row.realized_pnl as number,
    positions: positions.map((p) => ({
      pair: p.pair as string,
      side: p.side as "buy" | "sell",
      size: p.size as number,
      entryPrice: p.entry_price as number,
      openedAt: p.opened_at as number,
    })),
  };
}

export function savePortfolio(portfolio: PaperPortfolio): void {
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    "INSERT INTO paper_portfolios (user_id, base_currency_balance, realized_pnl, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET base_currency_balance = excluded.base_currency_balance, " +
      "realized_pnl = excluded.realized_pnl, updated_at = excluded.updated_at"
  ).run(portfolio.userId, portfolio.baseCurrencyBalance, portfolio.realizedPnl, now, now);

  db.prepare("DELETE FROM paper_positions WHERE user_id = ?").run(portfolio.userId);

  for (const pos of portfolio.positions) {
    db.prepare(
      "INSERT INTO paper_positions (user_id, pair, side, size, entry_price, opened_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(portfolio.userId, pos.pair, pos.side, pos.size, pos.entryPrice, pos.openedAt);
  }
}

export type { PaperPortfolio, PaperPosition };
