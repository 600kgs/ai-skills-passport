import { defineConfig } from "vitest/config";

// live/ talks to the deployed site and the public chain, so it runs on its own, with retries for a flaky devnet
export default defineConfig({ test: { include: ["live/**/*.test.ts"], testTimeout: 30_000, retry: 2 } });
