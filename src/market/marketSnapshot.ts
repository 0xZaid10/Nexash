import { get24hrTicker, getKlines, computeChange24hPct } from "./exchangeClient";
import { computeIndicators, type ComputedIndicators } from "./indicators";
import type { Kline } from "./exchangeClient";

export interface TimeframeData {
  interval: string;
  candles: Kline[];
  indicators: ComputedIndicators;
}

export interface RichMarketSnapshot {
  pair: string;
  lastPrice: string;
  change24hPct: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  timeframes: TimeframeData[];
}

export async function buildRichSnapshot(pair: string): Promise<RichMarketSnapshot> {
  const [ticker, candles1h, candles4h, candles15m] = await Promise.all([
    get24hrTicker(pair),
    getKlines(pair, "1h", 60),
    getKlines(pair, "4h", 60),
    getKlines(pair, "15m", 60),
  ]);

  return {
    pair: ticker.symbol,
    lastPrice: ticker.lastPrice,
    change24hPct: computeChange24hPct(ticker),
    volume24h: ticker.baseVolume,
    high24h: ticker.highPrice,
    low24h: ticker.lowPrice,
    timeframes: [
      { interval: "15m", candles: candles15m, indicators: computeIndicators(candles15m) },
      { interval: "1h", candles: candles1h, indicators: computeIndicators(candles1h) },
      { interval: "4h", candles: candles4h, indicators: computeIndicators(candles4h) },
    ],
  };
}

export function formatSnapshotForPrompt(snap: RichMarketSnapshot): string {
  const lines: string[] = [
    `Pair: ${snap.pair}`,
    `Price: $${parseFloat(snap.lastPrice).toLocaleString()}`,
    `24h change: ${snap.change24hPct}%`,
    `24h high: $${parseFloat(snap.high24h).toLocaleString()}`,
    `24h low: $${parseFloat(snap.low24h).toLocaleString()}`,
    `24h volume: ${snap.volume24h}`,
    "",
  ];

  for (const tf of snap.timeframes) {
    const ind = tf.indicators;
    lines.push(`[${tf.interval} timeframe]`);
    lines.push(`  Trend (EMA 9/21/50): ${ind.trend}`);
    lines.push(`  RSI(14): ${ind.rsi14 !== null ? ind.rsi14.toFixed(1) : "n/a"} — ${ind.rsiZone}`);
    lines.push(`  EMA9: ${ind.ema9 !== null ? ind.ema9.toFixed(2) : "n/a"}`);
    lines.push(`  EMA21: ${ind.ema21 !== null ? ind.ema21.toFixed(2) : "n/a"}`);
    lines.push(`  EMA50: ${ind.ema50 !== null ? ind.ema50.toFixed(2) : "n/a"}`);
    lines.push(`  VWAP: ${ind.vwap !== null ? ind.vwap.toFixed(2) : "n/a"}`);
    lines.push(`  ATR(14): ${ind.atr14 !== null ? ind.atr14.toFixed(2) : "n/a"}`);
    lines.push("");
  }

  return lines.join("\n");
}
