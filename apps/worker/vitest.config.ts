import { configDefaults, defineConfig } from "vitest/config";

// test files share one postgres database and truncate it, so they run one at a time.
// live/ checks the deployed site instead and has its own config
export default defineConfig({ test: { fileParallelism: false, exclude: [...configDefaults.exclude, "live/**"] } });
