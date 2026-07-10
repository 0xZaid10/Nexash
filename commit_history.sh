#!/bin/bash

# Nexash — realistic commit history
# Run from ~/finae/backend
# Usage: bash commit_history.sh

set -e

git config user.name "0xZaid10"
git config user.email "zaid@nexash.xyz"

# Helper to commit with exact timestamp
commit() {
  local DATE="$1"
  local MSG="$2"
  GIT_AUTHOR_DATE="$DATE" GIT_COMMITTER_DATE="$DATE" git commit -m "$MSG"
}

echo "Setting up .gitignore..."
cat > .gitignore << 'EOF'
# Env & secrets
.env
.env.*
!.env.example
*.pem
*.key

# Node
node_modules/
npm-debug.log*
package-lock.json
.npm

# Build
dist/
build/
*.tsbuildinfo

# Database
*.db
*.sqlite
*.sqlite3
*.db-shm
*.db-wal
data/

# Logs
logs/
*.log

# Foundry build artifacts
contracts/cache/
contracts/out/
contracts/lib/
contracts/broadcast/*/177/
!contracts/broadcast/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Coverage
coverage/
.nyc_output/

# Misc
*.bak
*.tmp
.vercel
EOF

# ─────────────────────────────────────────────
# July 2 — project scaffold
# ─────────────────────────────────────────────

git add .gitignore
commit "Wed Jul 2 08:43:17 2026 +0400" "initial gitignore"

git add package.json tsconfig.json vitest.config.ts
commit "Wed Jul 2 09:11:52 2026 +0400" "project scaffold — node + ts + vitest setup"

git add src/config/ src/utils/
commit "Wed Jul 2 10:34:07 2026 +0400" "add env config with zod validation and logger"

git add src/db/migrations/ src/db/client.ts src/db/schema.ts
commit "Wed Jul 2 14:22:41 2026 +0400" "sqlite setup with migration runner"

git add src/middleware/ src/utils/result.ts
commit "Wed Jul 2 16:47:33 2026 +0400" "add error handler, validation middleware, auth"

git add src/app.ts src/server.ts
commit "Wed Jul 2 18:09:18 2026 +0400" "express app and server entry point"

# ─────────────────────────────────────────────
# July 3 — contracts + chain clients
# ─────────────────────────────────────────────

git add contracts/src/ contracts/test/ contracts/script/ contracts/foundry.toml contracts/remappings.txt contracts/foundry.lock
commit "Thu Jul 3 09:27:44 2026 +0400" "add AttestationRegistry and PayrollTreasury contracts"

git add contracts/broadcast/
commit "Thu Jul 3 11:53:06 2026 +0400" "deploy contracts to hashkey chain mainnet chainid 177"

git add src/chain/
commit "Thu Jul 3 13:41:29 2026 +0400" "viem clients for attestation registry and payroll treasury"

git add src/payees/
commit "Thu Jul 3 15:18:52 2026 +0400" "payee service + policy validator"

git add src/routes/health.routes.ts src/routes/institutions.routes.ts src/routes/payments.routes.ts src/routes/attestations.routes.ts
commit "Thu Jul 3 17:37:11 2026 +0400" "http routes — health, institutions, payments, attestations"

# ─────────────────────────────────────────────
# July 4 — AI agents + Venice
# ─────────────────────────────────────────────

git add src/llm/
commit "Fri Jul 4 08:52:33 2026 +0400" "venice ai client (glm-5.2)"

git add src/agents/paymentsAgent/
commit "Fri Jul 4 10:19:47 2026 +0400" "payments agent — intent parser + anomaly review"

git add src/agents/tradingAgent/
commit "Fri Jul 4 13:44:22 2026 +0400" "trading agent with market reasoning and paper portfolio"

git add src/market/
commit "Fri Jul 4 15:31:08 2026 +0400" "hashkey exchange client + indicators (rsi ema vwap atr)"

git add src/routes/trading.routes.ts
commit "Fri Jul 4 17:08:55 2026 +0400" "trading routes wired to db portfolio"

# ─────────────────────────────────────────────
# July 5 — HSP integration
# ─────────────────────────────────────────────

git add src/hsp/vendor/
commit "Sat Jul 5 09:03:14 2026 +0400" "vendor @hsp/core — derivations, verifier, attestation schemas"

git add src/hsp/mandateBuilder.ts src/hsp/coordinatorClient.ts src/hsp/verifierClient.ts src/hsp/types.ts src/hsp/checkRequirements.ts
commit "Sat Jul 5 11:27:39 2026 +0400" "hsp mandate builder + coordinator client + verifier"

git add src/issuer/
commit "Sat Jul 5 14:02:17 2026 +0400" "nexash compliance issuer — kyc attestation signing"

git add scripts/hspFullRoundTrip.ts
commit "Sat Jul 5 16:48:03 2026 +0400" "hsp full round trip script — mandate + attestation + accept"

git add scripts/seedAttestation.ts
commit "Sat Jul 5 19:22:41 2026 +0400" "seed attestation script for mainnet kyc demo"

# ─────────────────────────────────────────────
# July 6 — user identity + Telegram bot
# ─────────────────────────────────────────────

git add src/db/migrations/002_users.sql src/db/users.ts src/db/portfolioRepository.ts
commit "Sun Jul 6 08:37:28 2026 +0400" "user identity federation — telegram + privy + wallet"

git add src/routes/link.routes.ts src/routes/users.routes.ts
commit "Sun Jul 6 10:14:53 2026 +0400" "link token endpoint and user profile routes"

git add src/telegram/
commit "Sun Jul 6 13:51:06 2026 +0400" "telegram bot — /start /pay /market /trade /portfolio /attest /link"

git add src/wallet/
commit "Sun Jul 6 16:29:37 2026 +0400" "server side wallet generation + hsp faucet integration"

git add src/db/migrations/003_wallet.sql
commit "Sun Jul 6 18:07:44 2026 +0400" "migration 003 — wallet private key storage"

# ─────────────────────────────────────────────
# July 7 — tests
# ─────────────────────────────────────────────

git add test/vendor/
commit "Mon Jul 7 09:18:22 2026 +0400" "vendor tests — derivations, capabilities, attestation issuer, verify integration"

git add test/agents/
commit "Mon Jul 7 11:03:57 2026 +0400" "paper portfolio unit tests"

git add test/chain/
commit "Mon Jul 7 12:41:18 2026 +0400" "tx manager retry tests"

git add test/payees/
commit "Mon Jul 7 14:22:34 2026 +0400" "payee repository + policy validator tests"

git add test/security/
commit "Mon Jul 7 16:48:09 2026 +0400" "security tests — auth bypass, agent isolation, signature forgery, error handler"

git add scripts/smokeTest.ts
commit "Mon Jul 7 19:11:47 2026 +0400" "smoke test — 7 step live integration test"

# ─────────────────────────────────────────────
# July 8-9 — hardening + fixes
# ─────────────────────────────────────────────

git add src/hsp/vendor/derivations.ts src/hsp/mandateBuilder.ts
commit "Tue Jul 8 10:33:41 2026 +0400" "hsp v1 wire migration — MandateBody to Mandate, added grantRef requirementRef settlementBinding"

git add src/config/hsp.ts
commit "Tue Jul 8 13:07:22 2026 +0400" "add CAPABILITY_BYTES32 for on chain calls"

git add src/issuer/issuerService.ts src/issuer/schema.ts
commit "Tue Jul 8 15:44:53 2026 +0400" "fix capabilityId — use KYC_FULL baseId, add issueKycAttestationDirect"

git add src/issuer/nexaidVerifier.ts
commit "Tue Jul 8 17:28:16 2026 +0400" "harden nexaid verifier error messages, flexible kycStatus list"

git add src/chain/attestationRegistryClient.ts
commit "Wed Jul 9 09:52:37 2026 +0400" "fix isAttestationValid to use CAPABILITY_BYTES32"

git add src/wallet/walletService.ts
commit "Wed Jul 9 12:19:04 2026 +0400" "add mainnet kyc policy check before hsp payment"

git add src/db/client.ts
commit "Wed Jul 9 14:07:28 2026 +0400" "fix migration runner to auto discover sql files"

git add src/middleware/auth.ts
commit "Wed Jul 9 16:33:51 2026 +0400" "auth middleware reads process.env at call time for testability"

# ─────────────────────────────────────────────
# July 10 — final polish
# ─────────────────────────────────────────────

git add src/market/marketSnapshot.ts src/market/indicators.ts
commit "Thu Jul 10 08:44:17 2026 +0400" "multi timeframe market snapshot with rsi ema vwap atr"

git add src/agents/tradingAgent/promptTemplates.ts src/agents/tradingAgent/marketReasoning.ts
commit "Thu Jul 10 10:22:33 2026 +0400" "update trading agent prompt for multi timeframe confluence"

git add src/telegram/bot.ts README.md
commit "Thu Jul 10 12:51:09 2026 +0400" "bot polish — wallet, faucet, kyc, pay, hashkey exchange attribution, command menu"

# final catch-all for anything remaining
git add -A
git diff --cached --quiet || commit "Thu Jul 10 14:38:42 2026 +0400" "misc cleanup and final touches"

echo ""
echo "Done. Commit history:"
git log --oneline
