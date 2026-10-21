import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// one .env at the repo root serves the web app and the worker alike
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {} // in production the env comes from docker, not a file

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  agentRules: false,
  // workspace packages ship as typescript source
  transpilePackages: ["@passport/core", "@passport/db"],
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
