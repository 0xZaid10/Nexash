import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { parsePaymentIntent } from "../agents/paymentsAgent/intentParser";
import { reviewPaymentBatch } from "../agents/paymentsAgent/anomalyReview";
import { reasonAboutMarket } from "../agents/tradingAgent/marketReasoning";
import { applyPaperTrade } from "../agents/tradingAgent/paperPortfolio";
import { get24hrTicker } from "../market/exchangeClient";
import { SqlitePayeeRepository } from "../db/schema";
import { validatePayeePolicy } from "../payees/policyValidator";
import { CAPABILITY } from "../config/hsp";
import { getOrCreateUserByTelegram, createLinkToken, createWalletForUser, getUserWallet } from "../db/users";
import { loadPortfolio, savePortfolio } from "../db/portfolioRepository";
import { callHspFaucet, getTestnetUsdcBalance, getHskBalance, issueKycForWallet, executeCompliantHspPayment } from "../wallet/walletService";

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });
const payeeRepo = new SqlitePayeeRepository();

// Register commands so they appear in Telegram's / menu
bot.setMyCommands([
  { command: "start", description: "Create your wallet and get started" },
  { command: "wallet", description: "Show your wallet address and balance" },
  { command: "faucet", description: "Fund your wallet with testnet USDC" },
  { command: "kyc", description: "Verify KYC on HashKey Chain mainnet" },
  { command: "pay", description: "Send a compliant HSP payment" },
  { command: "market", description: "Live market data + AI analysis" },
  { command: "portfolio", description: "Your paper trading portfolio with live P&L" },
  { command: "trade", description: "Simulate a paper trade" },
  { command: "attest", description: "Check KYC status for any address" },
  { command: "link", description: "Connect to the Nexash web dashboard" },
]);

function getUser(msg: TelegramBot.Message) {
  const telegramId = msg.from!.id.toString();
  const handle = msg.from?.username ?? msg.from?.first_name ?? undefined;
  return getOrCreateUserByTelegram(telegramId, handle);
}

function fmt(n: number, dp = 2) {
  return n.toFixed(dp);
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ?? "there";
  const user = getUser(msg);

  let walletLine = "";
  let existingWallet = getUserWallet(user.id);
  if (!existingWallet) {
    const created = createWalletForUser(user.id);
    existingWallet = created;
    walletLine = `\n\n✅ *Your Nexash wallet is ready*\n\`${created.address}\`\nRun /faucet to fund it with testnet USDC.`;
  } else {
    walletLine = `\n\n👛 *Your wallet*\n\`${existingWallet.address}\``;
  }

  bot.sendMessage(
    chatId,
    `Hey ${name}! 👋 Welcome to *Nexash* — AI-native compliant payments on HashKey Chain.${walletLine}\n\n` +
    `💳 *Wallet*\n/wallet — Show your wallet address + balance\n/faucet — Get testnet USDC\n/kyc — Verify KYC (demo)\n\n` +
    `💸 *Payments*\n/pay <amount> <address> — Send a compliant HSP payment\n\n` +
    `📈 *Trading*\n/market <pair> — Live data + AI reasoning\n` +
    `/portfolio — Your paper portfolio\n` +
    `/trade <buy|sell> <pair> <fraction> — Simulate a trade\n\n` +
    `🔐 *Compliance*\n/attest <address> — Check KYC status on-chain\n\n` +
    `🔗 *Account*\n/link — Connect to the web dashboard`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.emit("text", { ...msg, text: "/start" });
});

bot.onText(/\/wallet/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const wallet = getUserWallet(user.id);
  if (!wallet) {
    return bot.sendMessage(chatId, "No wallet yet. Send /start to create one.");
  }
  try {
    const [usdcBalance, hskBalance] = await Promise.all([
      getTestnetUsdcBalance(wallet.address),
      getHskBalance(wallet.address),
    ]);
    await bot.sendMessage(
      chatId,
      `👛 *Your Nexash Wallet*\n\n` +
      `Address: \`${wallet.address}\`\n\n` +
      `*Testnet Balances*\n` +
      `USDC: *${usdcBalance.toFixed(2)} USDC*\n` +
      `HSK: *${hskBalance.toFixed(4)} HSK*\n\n` +
      `🔗 [View on Testnet Explorer](https://testnet-explorer.hsk.xyz/address/${wallet.address})\n\n` +
      `_/faucet to get testnet USDC_`,
      { parse_mode: "Markdown" }
    );
  } catch {
    await bot.sendMessage(chatId, `👛 *Your wallet*\n\`${wallet.address}\``, { parse_mode: "Markdown" });
  }
});

bot.onText(/\/faucet/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const wallet = getUserWallet(user.id);
  if (!wallet) {
    return bot.sendMessage(chatId, "No wallet yet. Send /start first.");
  }
  await bot.sendMessage(chatId, `⏳ Requesting testnet USDC for \`${wallet.address}\`...`, { parse_mode: "Markdown" });
  try {
    const result = await callHspFaucet(wallet.address);
    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ *Faucet successful!*\n\nYour wallet has been funded with testnet USDC.\n${result.txHash ? `\nTx: \`${result.txHash}\`` : ""}\n\nRun /wallet to check your balance.`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot.sendMessage(chatId, `❌ Faucet failed: ${result.message}\n\nTry again in a moment.`);
    }
  } catch (err) {
    logger.error("Faucet error", { err });
    await bot.sendMessage(chatId, "Faucet request failed. Try again.");
  }
});

bot.onText(/\/kyc/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const wallet = getUserWallet(user.id);
  if (!wallet) {
    return bot.sendMessage(chatId, "No wallet yet. Send /start first.");
  }

  await bot.sendMessage(chatId, "🔐 Issuing demo KYC attestation on HashKey Chain mainnet...");

  try {
    const { txHash, alreadyAttested } = await issueKycForWallet(wallet.address);

    if (alreadyAttested) {
      return bot.sendMessage(
        chatId,
        `✅ *Already KYC Verified*\n\n` +
        `Wallet \`${wallet.address}\` already has a valid KYC attestation on HashKey Chain mainnet.\n\n` +
        `You can make compliant payments with /pay.\n\n` +
        `🔗 [Check on Blockscout](https://hsk.blockscout.com/address/${wallet.address})`,
        { parse_mode: "Markdown" }
      );
    }

    await bot.sendMessage(
      chatId,
      `✅ *KYC Attestation Issued*\n\n` +
      `Wallet: \`${wallet.address}\`\n` +
      `Level: 3 — Enhanced\n` +
      `Valid for: 90 days\n` +
      `Network: HashKey Chain Mainnet (chainId 177)\n` +
      `Tx: \`${txHash}\`\n` +
      `🔗 [View on Blockscout](https://hsk.blockscout.com/tx/${txHash})\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `ℹ️ *About KYC on Nexash*\n\n` +
      `In production, this step requires a real compliance check via NexaID — a zkTLS-based identity verification that proves your Binance KYC status on-chain without exposing personal data.\n\n` +
      `Users will complete this through the *Nexash dashboard* (coming soon), which connects their wallet, runs the NexaID Chrome extension, and anchors the proof permanently on HashKey Chain.\n\n` +
      `_Until then, /kyc issues a demo attestation directly._`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    logger.error("KYC issuance error", { err });
    await bot.sendMessage(chatId, `❌ KYC issuance failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }
});

bot.onText(/\/pay(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const wallet = getUserWallet(user.id);
  const instruction = match?.[1]?.trim();

  if (!instruction) {
    return bot.sendMessage(
      chatId,
      "Send a compliant HSP payment.\nExample:\n`/pay 1 0x2222222222222222222222222222222222222222`\n\nor describe it naturally:\n`/pay send 1 USDC to 0x2222...`",
      { parse_mode: "Markdown" }
    );
  }

  if (!wallet) {
    return bot.sendMessage(chatId, "No wallet yet. Send /start to create one, then /faucet to fund it.");
  }

  // Parse amount and address from instruction
  const amountMatch = instruction.match(/(\d+(?:\.\d+)?)/);
  const addressMatch = instruction.match(/(0x[0-9a-fA-F]{40})/i);

  if (!amountMatch || !addressMatch) {
    return bot.sendMessage(
      chatId,
      "Please include an amount and recipient address.\nExample: `/pay 1 0x2222...`",
      { parse_mode: "Markdown" }
    );
  }

  const amountUsdc = parseFloat(amountMatch[1]);
  const recipientAddress = addressMatch[1];

  // Check balance first
  let balance = 0;
  try {
    balance = await getTestnetUsdcBalance(wallet.address);
  } catch {}

  if (balance < amountUsdc) {
    return bot.sendMessage(
      chatId,
      `❌ Insufficient balance.\n\nYour balance: *${balance.toFixed(2)} USDC*\nRequired: *${amountUsdc} USDC*\n\nRun /faucet to get testnet USDC.`,
      { parse_mode: "Markdown" }
    );
  }

  await bot.sendMessage(
    chatId,
    `⏳ *Executing compliant HSP payment...*\n\n` +
    `Amount: *${amountUsdc} USDC*\n` +
    `To: \`${recipientAddress}\`\n\n` +
    `Steps: issuing KYC attestation → building mandate → on-chain transfer → verifying...`,
    { parse_mode: "Markdown" }
  );

  try {
    const result = await executeCompliantHspPayment({
      payerPrivateKey: wallet.privateKey,
      payerAddress: wallet.address,
      recipientAddress,
      amountUsdc,
    });

    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ *Payment SETTLED — ACCEPT*\n\n` +
        `Amount: *${amountUsdc} USDC* (testnet)\n` +
        `To: \`${recipientAddress}\`\n` +
        `paymentId: \`${result.paymentId}\`\n` +
        `txHash: \`${result.txHash}\`\n` +
        `🔗 [View on Testnet Explorer](https://testnet-explorer.hsk.xyz/tx/${result.txHash})\n\n` +
        `🔗 [View on HSP Explorer](${result.explorerUrl})\n\n` +
        `_Compliance verified by Nexash registered issuer • HashKey Chain_`,
        { parse_mode: "Markdown" }
      );
    } else if (result.error?.startsWith("POLICY_KYC_REQUIRED")) {
      await bot.sendMessage(
        chatId,
        `❌ *Payment blocked — KYC required*\n\n` +
        `Your wallet \`${wallet.address}\` has no valid KYC attestation on HashKey Chain mainnet.\n\n` +
        `Run /kyc to get verified, then try again.`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot.sendMessage(chatId, `❌ Payment failed: ${result.error}`);
    }
  } catch (err) {
    logger.error("Telegram /pay HSP error", { err });
    await bot.sendMessage(chatId, `❌ Payment error: ${err instanceof Error ? err.message : "unknown"}`);
  }
});
bot.onText(/\/market(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const pair = (match?.[1]?.trim().toUpperCase() ?? "BTCUSDT").replace("/", "");

  await bot.sendMessage(chatId, `📡 Fetching ${pair} data + computing indicators...`);

  try {
    const { buildRichSnapshot, formatSnapshotForPrompt } = await import("../market/marketSnapshot");
    const snap = await buildRichSnapshot(pair);
    const changeNum = parseFloat(snap.change24hPct);
    const changeEmoji = changeNum > 0 ? "📈" : changeNum < 0 ? "📉" : "➡️";
    const tf1h = snap.timeframes.find((t) => t.interval === "1h")?.indicators;

    await bot.sendMessage(chatId, "🧠 Analyzing with multi-timeframe indicators...");

    const reasoning = await reasonAboutMarket({
      userQuestion: `What's your read on ${pair} right now? Should I consider a position?`,
      pair,
    });

    let response =
      `${changeEmoji} *${snap.pair}*\n` +
      `Price: *$${parseFloat(snap.lastPrice).toLocaleString()}*\n` +
      `24h: ${changeNum > 0 ? "+" : ""}${snap.change24hPct}%  |  High: $${parseFloat(snap.high24h).toLocaleString()}  |  Low: $${parseFloat(snap.low24h).toLocaleString()}\n`;

    if (tf1h) {
      response +=
        `\n📊 *1h indicators*\n` +
        `Trend: ${tf1h.trend}  |  RSI: ${tf1h.rsi14?.toFixed(1) ?? "n/a"} (${tf1h.rsiZone})\n` +
        `EMA9: ${tf1h.ema9?.toFixed(2) ?? "n/a"}  |  EMA21: ${tf1h.ema21?.toFixed(2) ?? "n/a"}  |  VWAP: ${tf1h.vwap?.toFixed(2) ?? "n/a"}\n`;
    }

    response += `\n🤖 *Agent analysis*\n${reasoning.reasoning}\n\nConfidence: *${reasoning.confidence}*`;

    if (reasoning.proposedAction) {
      const a = reasoning.proposedAction;
      const snap2 = snap;
      const suggestedAmount = Math.round(parseFloat(snap2.lastPrice) ? a.sizeFraction * 1000 : 100);
      response +=
        `\n\n💡 *Suggested*: ${a.side.toUpperCase()} ${a.pair} — $${suggestedAmount}\n` +
        `_/trade ${a.side} ${a.pair} ${suggestedAmount} to simulate_`;
    }

    response += `\n\n_Simulated only — no real funds._\n_📊 Market data: [HashKey Exchange](https://www.hashkey.com/en-US)_\n_🔜 Live trading coming soon_`;
    await bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (err) {
    logger.error("Telegram /market error", { err });
    await bot.sendMessage(chatId, `Couldn't fetch data for ${pair}. Check the symbol and try again.`);
  }
});

bot.onText(/\/portfolio/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const p = loadPortfolio(user.id);

  let response = `📊 *Your paper portfolio*\n\nBalance: *$${fmt(p.baseCurrencyBalance)}*\nRealized P&L: *$${fmt(p.realizedPnl)}*\n\n`;

  if (p.positions.length === 0) {
    response += `No open positions.\n\nUse /market to get a trade idea.`;
  } else {
    response += `*Open positions*\n`;
    let totalUnrealized = 0;
    for (const pos of p.positions) {
      try {
        const ticker = await get24hrTicker(pos.pair);
        const currentPrice = parseFloat(ticker.lastPrice);
        const unrealized = (currentPrice - pos.entryPrice) * pos.size;
        totalUnrealized += unrealized;
        const pnlEmoji = unrealized >= 0 ? "📈" : "📉";
        response +=
          `• *${pos.pair}* — ${pos.size.toFixed(4)} @ $${fmt(pos.entryPrice)}\n` +
          `  Now: $${fmt(currentPrice)}  ${pnlEmoji} P&L: $${fmt(unrealized)}\n`;
      } catch {
        response += `• *${pos.pair}* — ${pos.size.toFixed(4)} @ $${fmt(pos.entryPrice)} _(price unavailable)_\n`;
      }
    }
    response += `\n*Unrealized P&L: $${fmt(totalUnrealized)}*`;
    response += `\n*Total P&L: $${fmt(p.realizedPnl + totalUnrealized)}*`;
    response += `\n\n_📊 Live prices: [HashKey Exchange](https://www.hashkey.com/en-US)_\n_🔜 Live trading coming soon_`;
  }

  await bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
});

bot.onText(/\/trade\s+(buy|sell)\s+(\S+)\s+([\d.]+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!match) return;

  const side = match[1].toLowerCase() as "buy" | "sell";
  const pair = match[2].toUpperCase().replace("/", "");
  const amount = parseFloat(match[3]);

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(
      chatId,
      "Please specify a valid amount in USD.\n\nExamples:\n`/trade buy BTCUSDT 100` — buy $100 worth of BTC\n`/trade sell SOLUSDT 50` — sell $50 worth of SOL",
      { parse_mode: "Markdown" }
    );
  }

  try {
    const ticker = await get24hrTicker(pair);
    const price = parseFloat(ticker.lastPrice);
    const user = getUser(msg);
    const portfolio = loadPortfolio(user.id);

    if (side === "buy") {
      if (amount > portfolio.baseCurrencyBalance) {
        return bot.sendMessage(
          chatId,
          `❌ *Insufficient balance*\n\nYou want to spend *$${fmt(amount)}* but your balance is *$${fmt(portfolio.baseCurrencyBalance)}*.\n\nTry a smaller amount.`,
          { parse_mode: "Markdown" }
        );
      }

      const sizeFraction = amount / portfolio.baseCurrencyBalance;
      const result = applyPaperTrade(portfolio, { side, pair, sizeFraction }, price);

      if (!result.executed) {
        return bot.sendMessage(chatId, `❌ Trade not executed: ${result.reason}`);
      }

      savePortfolio(result.portfolio);
      const pos = result.portfolio.positions.find((p) => p.pair === pair);
      const quantity = pos ? pos.size.toFixed(6) : "—";

      await bot.sendMessage(
        chatId,
        `✅ *Bought ${pair}*\n\n` +
        `Spent: *$${fmt(amount)}*\n` +
        `Price: $${fmt(price)}\n` +
        `Quantity: ${quantity}\n` +
        `Remaining balance: *$${fmt(result.portfolio.baseCurrencyBalance)}*\n\n` +
        `📊 Price data: [HashKey Exchange](https://www.hashkey.com/en-US)\n` +
        `_Paper trade — no real funds moved._\n` +
        `_🔜 Live HashKey Exchange trading coming soon_`,
        { parse_mode: "Markdown" }
      );

    } else {
      // sell — amount is in USD worth to sell
      const pos = portfolio.positions.find((p) => p.pair === pair && p.side === "buy");
      if (!pos) {
        return bot.sendMessage(chatId, `❌ No open position in ${pair}.\n\nBuy first with /trade buy ${pair} <amount>`);
      }

      const positionValueUsd = pos.size * price;
      if (amount > positionValueUsd) {
        return bot.sendMessage(
          chatId,
          `❌ *Insufficient position*\n\nYou want to sell *$${fmt(amount)}* of ${pair} but your position is worth *$${fmt(positionValueUsd)}*.\n\nTry /trade sell ${pair} ${Math.floor(positionValueUsd)} or less.`,
          { parse_mode: "Markdown" }
        );
      }

      const sizeFraction = amount / positionValueUsd;
      const result = applyPaperTrade(portfolio, { side, pair, sizeFraction }, price);

      if (!result.executed) {
        return bot.sendMessage(chatId, `❌ Trade not executed: ${result.reason}`);
      }

      savePortfolio(result.portfolio);
      const pnl = result.portfolio.realizedPnl - portfolio.realizedPnl;
      const pnlEmoji = pnl >= 0 ? "📈" : "📉";

      await bot.sendMessage(
        chatId,
        `✅ *Sold ${pair}*\n\n` +
        `Sold: *$${fmt(amount)}* worth\n` +
        `Price: $${fmt(price)}\n` +
        `${pnlEmoji} Realized P&L: *$${fmt(pnl)}*\n` +
        `Balance: *$${fmt(result.portfolio.baseCurrencyBalance)}*\n\n` +
        `📊 Price data: [HashKey Exchange](https://www.hashkey.com/en-US)\n` +
        `_Paper trade — no real funds moved._\n` +
        `_🔜 Live HashKey Exchange trading coming soon_`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    logger.error("Telegram /trade error", { err });
    await bot.sendMessage(chatId, `Couldn't execute that trade. Check the pair symbol and try again.`);
  }
});

bot.onText(/\/attest(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const address = match?.[1]?.trim();

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return bot.sendMessage(chatId, "Please provide a valid EVM address.\nExample: `/attest 0x1234...`", {
      parse_mode: "Markdown",
    });
  }

  await bot.sendMessage(chatId, `🔍 Checking on-chain attestation for \`${address}\`...`, { parse_mode: "Markdown" });

  try {
    const { isAttestationValid, getOnChainAttestation } = await import("../chain/attestationRegistryClient");
    const { CAPABILITY_BYTES32 } = await import("../config/hsp");

    const isValid = await isAttestationValid(address as `0x${string}`, CAPABILITY_BYTES32.KYC);

    if (!isValid) {
      return bot.sendMessage(
        chatId,
        `❌ *No valid KYC attestation*\n\n\`${address}\`\n\nThis address has no active KYC attestation on Nexash's registry.\n\n🔗 [View on Blockscout](https://hsk.blockscout.com/address/${address})`,
        { parse_mode: "Markdown" }
      );
    }

    const att = await getOnChainAttestation(address as `0x${string}`, CAPABILITY_BYTES32.KYC);
    const expiry = att?.expiresAt ? new Date(Number(att.expiresAt) * 1000).toLocaleDateString() : "Unknown";
    const level = att?.kycLevel ?? "3";

    await bot.sendMessage(
      chatId,
      `✅ *KYC Verified*\n\n` +
      `Address: \`${address}\`\n` +
      `Level: *${level} — Enhanced*\n` +
      `Network: HashKey Chain Mainnet\n` +
      `Expires: *${expiry}*\n\n` +
      `🔗 [View on Blockscout](https://hsk.blockscout.com/address/${address})`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    logger.error("Telegram /attest error", { err });
    await bot.sendMessage(chatId, "Couldn't check attestation status. Please try again.");
  }
});

bot.onText(/\/addpayee\s+(\S+)\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!match) return;

  const identifier = match[1];
  const address = match[2] as `0x${string}`;

  const validation = validatePayeePolicy({
    identifier,
    address,
    requiredCapability: CAPABILITY.KYC,
    minKycLevel: 1,
    perPaymentLimit: "10000",
    dailyLimit: "50000",
  });

  if (!validation.valid) {
    return bot.sendMessage(chatId, `❌ Invalid: ${validation.errors.join(", ")}`);
  }

  try {
    await payeeRepo.upsert(identifier, address);
    await bot.sendMessage(
      chatId,
      `✅ *Payee registered*\n\nID: \`${identifier}\`\nAddress: \`${address}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    logger.error("Telegram /addpayee error", { err });
    await bot.sendMessage(chatId, "Failed to register payee. Please try again.");
  }
});

bot.onText(/\/payees/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const payees = await payeeRepo.listAll();
    if (payees.length === 0) {
      return bot.sendMessage(chatId, "No payees registered yet.\nUse `/addpayee <id> <address>` to add one.", {
        parse_mode: "Markdown",
      });
    }
    let response = `👥 *Registered payees* (${payees.length})\n\n`;
    for (const p of payees) {
      response += `• \`${p.identifier}\` → \`${p.address.slice(0, 10)}...\`\n`;
    }
    await bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (err) {
    logger.error("Telegram /payees error", { err });
    await bot.sendMessage(chatId, "Couldn't fetch payees. Please try again.");
  }
});

bot.onText(/\/history(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const identifier = match?.[1]?.trim();

  if (!identifier) {
    return bot.sendMessage(chatId, "Provide a payee ID.\nExample: `/history alice`", { parse_mode: "Markdown" });
  }

  try {
    const { getPaymentHistoryForPayee } = await import("../db/schema");
    const history = getPaymentHistoryForPayee(identifier);

    if (history.length === 0) {
      return bot.sendMessage(chatId, `No payment history found for *${identifier}*.`, { parse_mode: "Markdown" });
    }

    let response = `📜 *History for ${identifier}*\n\n`;
    for (const h of history.slice(0, 10)) {
      const date = new Date(h.releasedAt * 1000).toLocaleDateString();
      response += `• ${date} — *${h.amount}* ${h.token}\n`;
    }
    if (history.length > 10) response += `_...and ${history.length - 10} more_`;

    await bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
  } catch (err) {
    logger.error("Telegram /history error", { err });
    await bot.sendMessage(chatId, "Couldn't fetch payment history. Please try again.");
  }
});

bot.onText(/\/link/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(msg);
  const token = createLinkToken(user.id);

  await bot.sendMessage(
    chatId,
    `🔗 *Link your account*\n\nVisit the Nexash dashboard and enter this code to connect your Telegram account:\n\n\`${token}\`\n\n_Expires in 15 minutes. Don't share this code._`,
    { parse_mode: "Markdown" }
  );
});

bot.on("polling_error", (err) => {
  logger.error("Telegram polling error", { err });
});

export { bot };
