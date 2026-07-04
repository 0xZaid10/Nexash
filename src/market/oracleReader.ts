import { createPublicClient, http } from "viem";
import { activeChain } from "../config/chains";
import { env } from "../config/env";

/**
 * APRO price feed addresses, from
 * hackathon_refs/hashkey/Build-on-HashKey-Chain__Tools__Oracle.md.
 *
 * KNOWN DATA ISSUE - HSK/USD mainnet address is INCOMPLETE in the source
 * doc: "0x86CE42c1b714149Dc3A7b169EF67b5F78A224b" is only 39 hex characters
 * (38 after 0x), one character short of a valid 40-hex-char EVM address -
 * every sibling address in the same table is the correct length, so this
 * is a transcription/scraping artifact in the doc, not a deliberate short
 * address. DO NOT use this constant until the correct full address is
 * re-confirmed (re-scrape the HashKey docs page, or check APRO's own docs
 * directly) - calling readPrice() for HSK/USD will throw until then.
 */
const APRO_FEED_ADDRESSES = {
  "hashkey-mainnet": {
    "BTC/USD": "0x204ED500ab56A2E19B051561258E3A45c850360F",
    "HSK/USD": null, // INCOMPLETE ADDRESS IN SOURCE DOC - see comment above
    "USDT/USD": "0x823d7f90f7A3498DB6595886b6B5dC95E6B0B7f3",
    "USDC/USD": "0x244Ce344df8837c9d938867E2Ffbf0E4B0169B56",
  },
  "hashkey-testnet": {
    "BTC/USD": "0x64697A6Abb508079687465FA9EF99D2Da955D791",
    "USDT/USD": "0xC45D520D18A465Ec23eE99A58Dc4cB96b357E744",
    "USDC/USD": "0xCdB10dC9dB30B6ef2a63aB4460263655808fAE27",
  },
} as const;

type FeedKey = keyof typeof APRO_FEED_ADDRESSES;

const APRO_PRICE_FEED_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

export interface OraclePriceReading {
  pair: string;
  price: bigint;
  updatedAt: bigint;
}

export async function readOraclePrice(
  pair: "BTC/USD" | "HSK/USD" | "USDT/USD" | "USDC/USD"
): Promise<OraclePriceReading> {
  const feedKey = env.ACTIVE_CHAIN as FeedKey;
  const addresses = APRO_FEED_ADDRESSES[feedKey] as Record<string, string | null>;
  const address = addresses[pair];

  if (!address) {
    throw new Error(
      `No confirmed APRO feed address for ${pair} on ${feedKey}. ` +
        (pair === "HSK/USD"
          ? "The source doc's HSK/USD mainnet address is known to be incomplete - see oracleReader.ts comments."
          : "This pair may not have a feed on this network.")
    );
  }

  const [, answer, , updatedAt] = (await publicClient.readContract({
    address: address as `0x${string}`,
    abi: APRO_PRICE_FEED_ABI,
    functionName: "latestRoundData",
  })) as [bigint, bigint, bigint, bigint, bigint];

  return { pair, price: answer, updatedAt };
}
