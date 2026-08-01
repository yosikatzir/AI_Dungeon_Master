import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors server.ts's `tsx --env-file-if-exists=.env.local` — some modules
// (e.g. lib/ai/openai.ts) read process.env.OPENAI_API_KEY at import time, so
// tests that touch them transitively need it set the same way the dev
// server already gets it.
const envLocalPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
