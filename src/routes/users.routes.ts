import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { findUserByPrivyId, findUserById } from "../db/users";
import { loadPortfolio } from "../db/portfolioRepository";
import { get24hrTicker } from "../market/exchangeClient";
import { getUnrealizedPnl } from "../agents/tradingAgent/paperPortfolio";
import { NotFoundError } from "../utils/result";

export const usersRouter = Router();

const MeBodySchema = z.object({
  privyUserId: z.string().min(1),
});

usersRouter.post("/users/me", validateBody(MeBodySchema), (req, res) => {
  const { privyUserId } = req.body;
  const user = findUserByPrivyId(privyUserId);
  if (!user) throw new NotFoundError("No Nexash account linked to this Privy user.");

  res.json({
    id: user.id,
    telegramHandle: user.telegramHandle,
    walletAddress: user.walletAddress,
    hasTelegram: user.telegramId !== null,
    hasWallet: user.walletAddress !== null,
  });
});

usersRouter.get("/users/:userId/portfolio", async (req, res) => {
  const { userId } = req.params;
  const user = findUserById(userId);
  if (!user) throw new NotFoundError(`User "${userId}" not found`);

  const portfolio = loadPortfolio(userId);
  const pairs = [...new Set(portfolio.positions.map((p) => p.pair))];
  const tickers = pairs.length > 0 ? await Promise.all(pairs.map((pair) => get24hrTicker(pair))) : [];
  const currentPrices = Object.fromEntries(tickers.map((t) => [t.symbol, Number(t.lastPrice)]));
  const unrealizedPnl = getUnrealizedPnl(portfolio, currentPrices);

  res.json({
    portfolio,
    unrealizedPnl,
    totalPnl: portfolio.realizedPnl + unrealizedPnl,
  });
});
