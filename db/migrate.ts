import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb, closeDb, rows } from "./client";

/** Applies drizzle migrations (db/migrations) and then the idempotent RLS script. Works for PGlite and Postgres. */
export async function migrate() {
  const db = await getDb();
  await db.execute(sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(process.cwd(), "db/migrations");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];
  const applied = new Set(rows<{ name: string }>(await db.execute(sql`select name from _migrations`)).map((r) => r.name));
  for (const f of files) {
    if (applied.has(f)) continue;
    const statements = fs.readFileSync(path.join(dir, f), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await db.transaction(async (tx) => {
      for (const s of statements) await tx.execute(sql.raw(s));
      await tx.execute(sql`insert into _migrations (name) values (${f})`);
    });
    console.log(`migrated: ${f}`);
  }
  const rls = fs.readFileSync(path.join(process.cwd(), "db/rls.sql"), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  for (const s of rls) await db.execute(sql.raw(s));
  console.log(`rls: ${rls.length} statements applied`);
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  migrate().then(() => closeDb()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
