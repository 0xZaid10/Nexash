import { type Hex } from "viem";
import { env } from "../src/config/env";
import { recordAttestationOnChain, isAttestationValid } from "../src/chain/attestationRegistryClient";
import { CAPABILITY_BYTES32 } from "../src/config/hsp";

const SUBJECT = (process.argv[2] ?? env.NEXASH_ISSUER_ADDRESS) as `0x${string}`;
const KYC_LEVEL = parseInt(process.argv[3] ?? "3");
const VALIDITY_DAYS = 90;

const MOCK_REPORT_TX = ("0x" + "ab".repeat(32)) as Hex;
const MOCK_TASK_ID = ("0x" + "cd".repeat(32)) as Hex;

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {
  section("Seeding mock KYC attestation on mainnet");
  console.log("Subject:", SUBJECT);
  console.log("KYC level:", KYC_LEVEL);
  console.log("Network: HashKey Chain Mainnet (chainId 177)");
  console.log("Registry:", env.ATTESTATION_REGISTRY_ADDRESS);

  section("1. Check if already attested");
  const alreadyValid = await isAttestationValid(SUBJECT, CAPABILITY_BYTES32.KYC);
  if (alreadyValid) {
    console.log("Already has a valid attestation — skipping write.");
    process.exit(0);
  }
  console.log("No valid attestation found, proceeding to write...");

  section("2. Write mock attestation on-chain");
  const expiresAt = Math.floor(Date.now() / 1000) + VALIDITY_DAYS * 24 * 60 * 60;
  try {
    const txHash = await recordAttestationOnChain({
      subject: SUBJECT,
      capability: CAPABILITY_BYTES32.KYC,
      reportTxHash: MOCK_REPORT_TX,
      taskId: MOCK_TASK_ID,
      kycLevel: KYC_LEVEL,
      expiresAt,
    });
    console.log("Transaction hash:", txHash);
    console.log("Blockscout:", `https://hashkey.blockscout.com/tx/${txHash}`);
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  section("3. Verify attestation was written");
  const isValid = await isAttestationValid(SUBJECT, CAPABILITY_BYTES32.KYC);
  if (isValid) {
    console.log(`PASS: ${SUBJECT} is now KYC-attested at level ${KYC_LEVEL} on mainnet`);
    console.log(`Expires: ${new Date(expiresAt * 1000).toLocaleDateString()}`);
  } else {
    console.log("FAIL: attestation was not written correctly");
  }
}

main();
