import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  HASHKEY_MAINNET_RPC_URL: z.string().url(),
  HASHKEY_TESTNET_RPC_URL: z.string().url(),
  ACTIVE_CHAIN: z.enum(["hashkey-mainnet", "hashkey-testnet"]).default("hashkey-mainnet"),
  HSP_CHAIN: z.enum(["hashkey-mainnet", "hashkey-testnet"]).default("hashkey-testnet"),

  ATTESTATION_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PAYROLL_TREASURY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  BACKEND_SIGNER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 32-byte hex-prefixed private key"),

  NEXASH_ISSUER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 32-byte hex-prefixed private key"),
  NEXASH_ISSUER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  HSP_COORDINATOR_URL: z.string().url(),
  HSP_API_KEY: z.string().min(1).optional(),

  NEXAID_API_BASE_URL: z.string().url(),
  NEXAID_KYC_TEMPLATE_ID: z.string().min(1),

  HASHKEY_EXCHANGE_API_BASE_URL: z.string().url().optional(),

  DATABASE_PATH: z.string().default("./data/nexash.sqlite"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  VENICE_API_KEY: z.string().min(1),
  VENICE_MODEL: z.string().default("zai-org-glm-5-2"),
  VENICE_API_BASE_URL: z.string().url().default("https://api.venice.ai/api/v1"),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  NEXASH_OPERATOR_API_KEY: z.string().min(16),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
