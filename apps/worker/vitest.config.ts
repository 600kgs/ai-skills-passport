import { defineConfig } from "vitest/config";

// test files share one postgres database and truncate it, so they run one at a time
export default defineConfig({ test: { fileParallelism: false } });
