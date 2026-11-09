import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/server-only.ts"),
    },
  },
  test: { include: ["tests/**/*.test.{ts,tsx}"], testTimeout: 30000 },
});
