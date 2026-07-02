import { env } from "../config/env";

/**
 * CONFIRMED 2026-06-28 directly by HashKey's API support (York Xu,
 * global-api@hashkey.com): public market data endpoints need NO
 * authentication and NO sandbox account, on production or sandbox alike.
 * We use the production base URL directly (https://api-glb.hashkey.com) -
 * no reason to stay on sandbox for an endpoint that needs no account at all.
 */

interface RawTicker24hr {
  t: number;
  s: string;
  c: string;
  h: string;
  l: string;
  o: string;
  b: string;
  a: string;
  v: string;
  qv: string;
  it: "SPOT" | "FUTURES" | "ANY";
}

export interface Ticker24hr {
  symbol: string;
  timestampMs: number;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
  bidPrice: string;
  askPrice: string;
  baseVolume: string;
  quoteVolume: string;
  instrumentType: "SPOT" | "FUTURES" | "ANY";
}

export type InstrumentType = "SPOT" | "FUTURES" | "ANY";

export type KlineInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "1w" | "1M";

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  numTrades: number;
}

export interface OrderBookDepth {
  timestampMs: number;
  bids: [number, number][]; // [price, qty]
  asks: [number, number][]; // [price, qty]
}

function baseUrl(): string {
  if (!env.HASHKEY_EXCHANGE_API_BASE_URL) {
    throw new Error(
      "HASHKEY_EXCHANGE_API_BASE_URL is not set. Use https://api-glb.sim.hashkeydev.com " +
        "for glb/uae sandbox, https://api-pro.sim.hashkeydev.com for hk/sg sandbox, " +
        "or the production equivalent once confirmed."
    );
  }
  return env.HASHKEY_EXCHANGE_API_BASE_URL.replace(/\/$/, "");
}

function mapTicker(raw: RawTicker24hr): Ticker24hr {
  return {
    symbol: raw.s,
    timestampMs: raw.t,
    lastPrice: raw.c,
    highPrice: raw.h,
    lowPrice: raw.l,
    openPrice: raw.o,
    bidPrice: raw.b,
    askPrice: raw.a,
    baseVolume: raw.v,
    quoteVolume: raw.qv,
    instrumentType: raw.it,
  };
}

/**
 * GET /quote/v1/ticker/24hr - public, no API key required.
 *
 * CORRECTED 2026-06-28: the real query parameter is `instType`
 * (SPOT/FUTURES/ANY), confirmed directly from HashKey Global Exchange's
 * full API doc. Site/region selection (glb/hk/sg/uae) is NOT a query
 * parameter on this endpoint - it's determined entirely by which base URL
 * is configured (HASHKEY_EXCHANGE_API_BASE_URL). An earlier version of
 * this function incorrectly sent a "site" query param, which doesn't exist
 * on this endpoint per the real spec.
 */
export async function get24hrTicker(
  symbol: string,
  instType: InstrumentType = "SPOT"
): Promise<Ticker24hr> {
  const url = `${baseUrl()}/quote/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}&instType=${instType}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HashKey Exchange ticker request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as RawTicker24hr[];
  if (!body.length) {
    throw new Error(`No ticker data returned for symbol ${symbol}`);
  }

  return mapTicker(body[0]);
}

export type KlineInterval =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h" | "6h" | "8h" | "12h"
  | "1d" | "1w" | "1M";

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export async function getKlines(
  symbol: string,
  interval: KlineInterval,
  limit = 50
): Promise<Kline[]> {
  const url = `${baseUrl()}/quote/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HashKey klines request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as unknown[][];

  return body.map((k) => ({
    openTime: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    trades: k[8] as number,
  }));
}

export function computeChange24hPct(ticker: Ticker24hr): string {
  const open = Number(ticker.openPrice);
  const last = Number(ticker.lastPrice);
  if (open === 0) return "0.00";
  return (((last - open) / open) * 100).toFixed(2);
}


export async function getOrderBookDepth(symbol: string, limit: number = 10): Promise<OrderBookDepth> {
  const url = `${baseUrl()}/quote/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HashKey depth request failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as { t: number; b: string[][]; a: string[][] };
  return {
    timestampMs: raw.t,
    bids: raw.b.map((b) => [parseFloat(b[0]!), parseFloat(b[1]!)] as [number, number]),
    asks: raw.a.map((a) => [parseFloat(a[0]!), parseFloat(a[1]!)] as [number, number]),
  };
}
