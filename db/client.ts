import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

export type Schema = typeof schema;
export type DB = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** A transaction handle has the same query API as DB. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

type Globals = { __tutorlab_db?: DB; __tutorlab_close?: () => Promise<void> };
const g = globalThis as unknown as Globals;

export const PGLITE_DIR = process.env.PGLITE_DIR ?? "./.data/pg";

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { max: 5, prepare: false });
    g.__tutorlab_close = () => client.end();
    return drizzle(client, { schema }) as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = PGLITE_DIR === "memory" ? undefined : PGLITE_DIR;
  if (dir) { const fs = await import("node:fs"); fs.mkdirSync(dir, { recursive: true }); }
  const client = new PGlite(dir, { extensions: { pg_trgm } });
  g.__tutorlab_close = () => client.close();
  return drizzle(client, { schema }) as unknown as DB;
}

let pending: Promise<DB> | undefined;
/**
 * Trusted ("system") connection — bypasses row level security.
 * Use only in server code that must see data across users: scoring, variant generation,
 * public question projection, jobs, seeds. Everything user-scoped goes through `withUser`.
 */
export async function getDb(): Promise<DB> {
  if (g.__tutorlab_db) return g.__tutorlab_db;
  pending ??= create().then((db) => (g.__tutorlab_db = db));
  return pending;
}

export async function closeDb() { await g.__tutorlab_close?.(); g.__tutorlab_db = undefined; pending = undefined; }

/**
 * Run `fn` in a transaction as the given user with row level security enforced:
 * switches to the unprivileged `app_user` role and sets `app.user_id` for the policies (db/rls.sql).
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

/** drizzle `execute()` returns `{rows}` on PGlite and an array on postgres-js — normalise. */
export function rows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export { schema };
