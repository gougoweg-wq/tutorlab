import { NextResponse } from "next/server";
import { runDueJobs } from "@/modules/jobs/queue";

export const dynamic = "force-dynamic";

/** Cron entry point (Vercel Cron / any scheduler). Protected by JOBS_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.JOBS_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await runDueJobs(25));
}
