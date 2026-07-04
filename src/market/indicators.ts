import type { Kline } from "./exchangeClient";

export function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i]! - slice[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function vwap(candles: Kline[]): number | null {
  if (candles.length === 0) return null;
  let cumPriceVol = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumPriceVol += typicalPrice * c.volume;
    cumVol += c.volume;
  }
  return cumVol === 0 ? null : cumPriceVol / cumVol;
}

export function atr(candles: Kline[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export interface ComputedIndicators {
  rsi14: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  vwap: number | null;
  atr14: number | null;
  trend: "bullish" | "bearish" | "neutral";
  rsiZone: "oversold" | "overbought" | "neutral";
}

export function computeIndicators(candles: Kline[]): ComputedIndicators {
  const closes = candles.map((c) => c.close);
  const rsi14 = rsi(closes, 14);
  const emas9 = ema(closes, 9);
  const emas21 = ema(closes, 21);
  const emas50 = ema(closes, 50);
  const vwapVal = vwap(candles);
  const atr14 = atr(candles, 14);

  const ema9Last = emas9.at(-1) ?? null;
  const ema21Last = emas21.at(-1) ?? null;
  const ema50Last = emas50.at(-1) ?? null;

  let trend: "bullish" | "bearish" | "neutral" = "neutral";
  if (ema9Last && ema21Last && ema50Last) {
    if (ema9Last > ema21Last && ema21Last > ema50Last) trend = "bullish";
    else if (ema9Last < ema21Last && ema21Last < ema50Last) trend = "bearish";
  }

  let rsiZone: "oversold" | "overbought" | "neutral" = "neutral";
  if (rsi14 !== null) {
    if (rsi14 < 30) rsiZone = "oversold";
    else if (rsi14 > 70) rsiZone = "overbought";
  }

  return { rsi14, ema9: ema9Last, ema21: ema21Last, ema50: ema50Last, vwap: vwapVal, atr14, trend, rsiZone };
}
