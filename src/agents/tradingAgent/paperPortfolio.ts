import type { ProposedPaperTrade } from "./marketReasoning";

/**
 * Pure in-memory/DB-backed simulation. No wallet, no signature, no network
 * call to any chain or exchange to execute anything - "executing" a paper
 * trade here means writing a row to our own database, full stop. This file
 * has no import from hsp/, chain/, or any settlement path, by design - it
 * is structurally impossible for this module to move real funds.
 */

export interface PaperPosition {
  pair: string;
  side: "buy" | "sell";
  size: number;
  entryPrice: number;
  openedAt: number;
}

export interface PaperPortfolioState {
  userId: string;
  baseCurrencyBalance: number;
  positions: PaperPosition[];
  realizedPnl: number;
}

export function createPaperPortfolio(
  userId: string,
  startingBalance: number
): PaperPortfolioState {
  return {
    userId,
    baseCurrencyBalance: startingBalance,
    positions: [],
    realizedPnl: 0,
  };
}

export interface ApplyTradeResult {
  portfolio: PaperPortfolioState;
  executed: boolean;
  reason?: string;
}

/**
 * Applies a proposed paper trade to a portfolio's simulated state. This is
 * the only place a ProposedPaperTrade (from marketReasoning.ts) actually
 * "does" anything - and what it does is mutate a row in our own database,
 * nothing more.
 */
export function applyPaperTrade(
  portfolio: PaperPortfolioState,
  trade: ProposedPaperTrade,
  currentPrice: number
): ApplyTradeResult {
  if (trade.sizeFraction <= 0 || trade.sizeFraction > 1) {
    return { portfolio, executed: false, reason: "sizeFraction out of bounds (0, 1]" };
  }

  if (trade.side === "buy") {
    const allocation = portfolio.baseCurrencyBalance * trade.sizeFraction;
    if (allocation <= 0) {
      return { portfolio, executed: false, reason: "insufficient paper balance" };
    }

    const size = allocation / currentPrice;

    return {
      portfolio: {
        ...portfolio,
        baseCurrencyBalance: portfolio.baseCurrencyBalance - allocation,
        positions: [
          ...portfolio.positions,
          { pair: trade.pair, side: "buy", size, entryPrice: currentPrice, openedAt: Date.now() },
        ],
      },
      executed: true,
    };
  }

  // side === "sell": close a matching long position, fraction of its size
  const matchingPosition = portfolio.positions.find(
    (p) => p.pair === trade.pair && p.side === "buy"
  );

  if (!matchingPosition) {
    return { portfolio, executed: false, reason: `no open position in ${trade.pair} to sell` };
  }

  const sizeToClose = matchingPosition.size * trade.sizeFraction;
  const proceeds = sizeToClose * currentPrice;
  const costBasis = sizeToClose * matchingPosition.entryPrice;
  const pnl = proceeds - costBasis;

  const remainingSize = matchingPosition.size - sizeToClose;
  const updatedPositions =
    remainingSize > 0
      ? portfolio.positions.map((p) =>
          p === matchingPosition ? { ...p, size: remainingSize } : p
        )
      : portfolio.positions.filter((p) => p !== matchingPosition);

  return {
    portfolio: {
      ...portfolio,
      baseCurrencyBalance: portfolio.baseCurrencyBalance + proceeds,
      positions: updatedPositions,
      realizedPnl: portfolio.realizedPnl + pnl,
    },
    executed: true,
  };
}

export function getUnrealizedPnl(
  portfolio: PaperPortfolioState,
  currentPrices: Record<string, number>
): number {
  return portfolio.positions.reduce((total, position) => {
    const currentPrice = currentPrices[position.pair];
    if (currentPrice === undefined) return total;
    const unrealized = (currentPrice - position.entryPrice) * position.size;
    return total + (position.side === "buy" ? unrealized : -unrealized);
  }, 0);
}
