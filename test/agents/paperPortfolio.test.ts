import { describe, it, expect } from "vitest";
import { createPaperPortfolio, applyPaperTrade, getUnrealizedPnl } from "../../src/agents/tradingAgent/paperPortfolio";

describe("createPaperPortfolio", () => {
  it("initializes with the given starting balance, no positions, zero realized PnL", () => {
    const p = createPaperPortfolio("user1", 10_000);
    expect(p.baseCurrencyBalance).toBe(10_000);
    expect(p.positions).toEqual([]);
    expect(p.realizedPnl).toBe(0);
  });
});

describe("applyPaperTrade - buy", () => {
  it("opens a position and reduces balance by the allocated amount", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const result = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 0.5 }, 100);

    expect(result.executed).toBe(true);
    expect(result.portfolio.baseCurrencyBalance).toBe(5_000);
    expect(result.portfolio.positions).toHaveLength(1);
    expect(result.portfolio.positions[0]).toMatchObject({ pair: "BTCUSDT", side: "buy", entryPrice: 100 });
    expect(result.portfolio.positions[0]!.size).toBeCloseTo(50, 6);
  });

  it("rejects sizeFraction of 0", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const result = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 0 }, 100);
    expect(result.executed).toBe(false);
  });

  it("rejects sizeFraction above 1", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const result = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1.5 }, 100);
    expect(result.executed).toBe(false);
  });

  it("accepts sizeFraction of exactly 1 (full balance)", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const result = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100);
    expect(result.executed).toBe(true);
    expect(result.portfolio.baseCurrencyBalance).toBe(0);
  });

  it("rejects a buy when balance is already zero", () => {
    const portfolio = { ...createPaperPortfolio("user1", 10_000), baseCurrencyBalance: 0 };
    const result = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 0.5 }, 100);
    expect(result.executed).toBe(false);
  });
});

describe("applyPaperTrade - sell", () => {
  it("closes a fraction of a profitable position and records correct realized PnL", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;

    const afterSell = applyPaperTrade(afterBuy, { side: "sell", pair: "BTCUSDT", sizeFraction: 0.5 }, 120);

    expect(afterSell.executed).toBe(true);
    expect(afterSell.portfolio.realizedPnl).toBeCloseTo(1000, 6);
    expect(afterSell.portfolio.baseCurrencyBalance).toBeCloseTo(6000, 6);
    expect(afterSell.portfolio.positions[0]!.size).toBeCloseTo(50, 6);
  });

  it("fully closes a position when sizeFraction is 1, removing it from positions", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;
    const afterSell = applyPaperTrade(afterBuy, { side: "sell", pair: "BTCUSDT", sizeFraction: 1 }, 100);

    expect(afterSell.portfolio.positions).toHaveLength(0);
  });

  it("records a loss correctly when selling below entry price", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;
    const afterSell = applyPaperTrade(afterBuy, { side: "sell", pair: "BTCUSDT", sizeFraction: 1 }, 80);

    expect(afterSell.portfolio.realizedPnl).toBeCloseTo(-2000, 6);
  });

  it("rejects selling a pair with no open position", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const result = applyPaperTrade(portfolio, { side: "sell", pair: "ETHUSDT", sizeFraction: 0.5 }, 100);
    expect(result.executed).toBe(false);
    expect(result.reason).toMatch(/no open position/);
  });

  it("accumulates realizedPnl across multiple partial sells", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;
    const afterSell1 = applyPaperTrade(afterBuy, { side: "sell", pair: "BTCUSDT", sizeFraction: 0.5 }, 120).portfolio;
    const afterSell2 = applyPaperTrade(afterSell1, { side: "sell", pair: "BTCUSDT", sizeFraction: 1 }, 130);

    expect(afterSell2.portfolio.realizedPnl).toBeCloseTo(2500, 6);
  });
});

describe("getUnrealizedPnl", () => {
  it("computes unrealized gain for an open long position", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;

    const unrealized = getUnrealizedPnl(afterBuy, { BTCUSDT: 150 });
    expect(unrealized).toBeCloseTo(5000, 6);
  });

  it("returns 0 for a position whose current price is not provided", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    const afterBuy = applyPaperTrade(portfolio, { side: "buy", pair: "BTCUSDT", sizeFraction: 1 }, 100).portfolio;

    const unrealized = getUnrealizedPnl(afterBuy, {});
    expect(unrealized).toBe(0);
  });

  it("returns 0 for an empty portfolio", () => {
    const portfolio = createPaperPortfolio("user1", 10_000);
    expect(getUnrealizedPnl(portfolio, { BTCUSDT: 100 })).toBe(0);
  });
});
