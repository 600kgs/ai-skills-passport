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
  // self-contained server for the docker image; trace from the repo root so workspace packages are included
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // workspace packages ship as typescript source
  transpilePackages: ["@passport/core", "@passport/db"],
  serverExternalPackages: ["pg", "pg-boss"],
  // forbidden() for signed-in accounts that aren't admins
  experimental: { authInterrupts: true },
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
