import { env } from "./config/env";
import { getIssuerAddress } from "./issuer/issuerService";
import { app } from "./app";
import { bot } from "./telegram/bot";
import { logger } from "./utils/logger";

const PORT = env.PORT;

function logStartupBanner() {
  console.log("Nexash backend starting");
  console.log(`  environment:     ${env.NODE_ENV}`);
  console.log(`  active chain:    ${env.ACTIVE_CHAIN}`);
  console.log(`  issuer address:  ${getIssuerAddress()}`);
  console.log(`  hsp coordinator: ${env.HSP_COORDINATOR_URL}`);
}

async function main() {
  logStartupBanner();

  app.listen(PORT, () => {
    console.log(`Nexash backend listening on port ${PORT}`);
    logger.info("Telegram bot polling started");
    bot;
  });
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
