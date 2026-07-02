import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/server.ts"],
    },
    testTimeout: 15000,
  },
});
