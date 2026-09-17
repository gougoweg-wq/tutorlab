import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { AppError } from "./result";

/** Fixed-window limiter backed by the `rate_limits` table. Throws AppError("rate_limited") when exceeded. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<void> {
  const db = await getDb();
  const res = rows<{ count: number }>(await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`));
  if ((res[0]?.count ?? 0) > max) throw new AppError("rate_limited");
}
