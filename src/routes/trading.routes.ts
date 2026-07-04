import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { reasonAboutMarket } from "../agents/tradingAgent/marketReasoning";
import { applyPaperTrade, getUnrealizedPnl } from "../agents/tradingAgent/paperPortfolio";
import { get24hrTicker } from "../market/exchangeClient";
import { loadPortfolio, savePortfolio } from "../db/portfolioRepository";
import { AppError } from "../utils/result";

export const tradingRouter = Router();

const DEFAULT_STARTING_BALANCE = 10_000;

const StartSessionBodySchema = z.object({
  userId: z.string().min(1),
  startingBalance: z.number().positive().optional(),
});

tradingRouter.post("/trading/session", validateBody(StartSessionBodySchema), (req, res) => {
  const { userId, startingBalance } = req.body;
  const portfolio = loadPortfolio(userId);

  if (portfolio.positions.length > 0 || portfolio.baseCurrencyBalance !== DEFAULT_STARTING_BALANCE) {
    throw new AppError(`A paper trading session already exists for user "${userId}"`, 409);
  }

  res.status(201).json(portfolio);
});

const AskBodySchema = z.object({
  userId: z.string().min(1),
  question: z.string().min(1),
  pairs: z.array(z.string()).min(1),
});

/**
 * Fetches real market data, asks the agent to reason over it, and -
 * IMPORTANT - only SIMULATES the proposed action against the paper
 * portfolio. marketReasoning.ts's result is typed simulatedOnly: true; this
 * route is what actually exercises that guarantee, by only ever calling
 * applyPaperTrade (which mutates an in-memory/DB record), never anything
 * in hsp/ or chain/.
 */
tradingRouter.post("/trading/ask", validateBody(AskBodySchema), async (req, res) => {
  const { userId, question, pairs } = req.body;
  const portfolio = loadPortfolio(userId);

  const pair = pairs[0] ?? "BTCUSDT";

  const reasoning = await reasonAboutMarket({ userQuestion: question, pair });

  let updatedPortfolio = portfolio;
  let tradeExecuted = false;

  if (reasoning.proposedAction) {
    const ticker = await get24hrTicker(reasoning.proposedAction.pair);
    const result = applyPaperTrade(portfolio, reasoning.proposedAction, Number(ticker.lastPrice));
    updatedPortfolio = result.portfolio;
    tradeExecuted = result.executed;
    if (result.executed) savePortfolio(updatedPortfolio);
  }

  res.json({
    reasoning: reasoning.reasoning,
    confidence: reasoning.confidence,
    proposedAction: reasoning.proposedAction,
    tradeExecuted,
    portfolio: updatedPortfolio,
  });
});

tradingRouter.get("/trading/:userId/portfolio", async (req, res) => {
  const portfolio = loadPortfolio(req.params.userId);

  const pairs = [...new Set(portfolio.positions.map((p) => p.pair))];
  const tickers = pairs.length > 0 ? await Promise.all(pairs.map((pair) => get24hrTicker(pair))) : [];
  const currentPrices = Object.fromEntries(tickers.map((t) => [t.symbol, Number(t.lastPrice)]));

  res.json({
    portfolio,
    unrealizedPnl: getUnrealizedPnl(portfolio, currentPrices),
  });
});
