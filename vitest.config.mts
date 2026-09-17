import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 60_000,
    pool: "forks",
    env: { PGLITE_DIR: "memory", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret" },
  },
  resolve: { alias: { "@": root, "server-only": path.join(root, "tests/helpers/server-only.ts") } },
});
