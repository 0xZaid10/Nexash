import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const AGENTS_DIR = join(__dirname, "../../src/agents");
const FORBIDDEN_IMPORT_PATTERNS = [
  /from ["']\.\.\/\.\.\/hsp\//,
  /from ["']\.\.\/\.\.\/chain\//,
  /from ["'].*\/hsp\//,
  /from ["'].*\/chain\//,
];

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(fullPath));
    else if (entry.name.endsWith(".ts")) files.push(fullPath);
  }
  return files;
}

describe("agent isolation - structural import check", () => {
  const agentFiles = listFilesRecursive(AGENTS_DIR);

  it("found at least the expected agent files (sanity check the test itself is looking at real files)", () => {
    expect(agentFiles.length).toBeGreaterThanOrEqual(6);
  });

  it.each(agentFiles)("%s does not import from hsp/ or chain/", (filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const importLines = content.split("\n").filter((l) => l.trim().startsWith("import"));

    for (const line of importLines) {
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(line).not.toMatch(pattern);
      }
    }
  });
});

describe("agent result types are structurally marked non-authoritative", () => {
  it("anomalyReview.ts's AnomalyReviewResult types advisoryOnly as a true literal, not boolean", () => {
    const content = readFileSync(join(AGENTS_DIR, "paymentsAgent/anomalyReview.ts"), "utf-8");
    expect(content).toMatch(/advisoryOnly:\s*true/);
    expect(content).not.toMatch(/advisoryOnly:\s*boolean/);
  });

  it("marketReasoning.ts's MarketReasoningResult types simulatedOnly as a true literal, not boolean", () => {
    const content = readFileSync(join(AGENTS_DIR, "tradingAgent/marketReasoning.ts"), "utf-8");
    expect(content).toMatch(/simulatedOnly:\s*true/);
    expect(content).not.toMatch(/simulatedOnly:\s*boolean/);
  });
});
