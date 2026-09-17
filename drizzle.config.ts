import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  // generate-only workflow: migrations are applied by db/migrate.ts (works for PGlite and Postgres)
});
