import { migrate } from "@/db/migrate";
import { getDb, closeDb } from "@/db/client";

/** Fresh in-memory Postgres (PGlite) with all migrations and RLS applied. Call in beforeAll; closeTestDb in afterAll. */
export async function setupTestDb() { process.env.PGLITE_DIR = "memory"; await closeDb(); await migrate(); return getDb(); }
export async function closeTestDb() { await closeDb(); }
