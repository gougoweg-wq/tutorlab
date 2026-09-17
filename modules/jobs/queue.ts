import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { log } from "@/modules/shared/log";

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, JobHandler>();

/** Register once at module load: `registerJob("ai.generate", async (p) => …)` (see jobs/index.ts). */
export function registerJob(name: string, handler: JobHandler) { handlers.set(name, handler); }

export async function enqueue(name: string, payload: Record<string, unknown> = {}, runAt: Date = new Date()): Promise<string> {
  const db = await getDb();
  const [row] = await db.insert(schema.jobs).values({ name, payload, runAt }).returning({ id: schema.jobs.id });
  return row.id;
}

/** Runs due jobs one by one. Safe to call concurrently: a job is claimed with a conditional update. */
export async function runDueJobs(limit = 10): Promise<{ ran: number; failed: number }> {
  await import("@/jobs");
  const db = await getDb();
  let ran = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const [next] = await db.select().from(schema.jobs).where(and(eq(schema.jobs.status, "queued"), lte(schema.jobs.runAt, new Date()))).orderBy(asc(schema.jobs.runAt)).limit(1);
    if (!next) break;
    const claimed = await db.update(schema.jobs).set({ status: "running", lockedAt: new Date(), attempts: sql`${schema.jobs.attempts} + 1` })
      .where(and(eq(schema.jobs.id, next.id), eq(schema.jobs.status, "queued"))).returning({ id: schema.jobs.id });
    if (!claimed.length) continue;
    const handler = handlers.get(next.name);
    try {
      if (!handler) throw new Error(`no handler for job "${next.name}"`);
      await handler(next.payload);
      await db.update(schema.jobs).set({ status: "done", finishedAt: new Date(), error: null }).where(eq(schema.jobs.id, next.id));
      ran += 1;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const attempts = next.attempts + 1; const retry = attempts < next.maxAttempts;
      await db.update(schema.jobs).set(retry ? { status: "queued", runAt: new Date(Date.now() + 30_000 * 2 ** attempts), error } : { status: "failed", finishedAt: new Date(), error }).where(eq(schema.jobs.id, next.id));
      log.error("job_failed", { name: next.name, id: next.id, error, retry });
      failed += 1;
    }
  }
  return { ran, failed };
}

/** Fire-and-forget kick after a request (use inside `after()` from next/server). */
export async function kickJobs() { try { await runDueJobs(5); } catch (e) { log.error("job_kick_failed", { error: String(e) }); } }
