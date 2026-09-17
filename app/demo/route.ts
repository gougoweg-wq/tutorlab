import { NextResponse } from "next/server";

/** Relative Location: behind a tunnel or proxy `req.url` is the internal address, so absolute redirects would point at localhost. */
const go = (path: string) => new NextResponse(null, { status: 307, headers: { location: path } });
import { getAuth } from "@/modules/auth/auth";
import { rateLimit } from "@/modules/shared/rate-limit";

export const dynamic = "force-dynamic";

/** One-click demo: signs the visitor in as the guest student (GUEST_EMAIL / GUEST_PASSWORD). Disabled when they are not configured. */
export async function GET(req: Request) {
  const email = process.env.GUEST_EMAIL, password = process.env.GUEST_PASSWORD;
  if (!email || !password) return go("/login");
  try { await rateLimit(`demo:${req.headers.get("x-forwarded-for") ?? "local"}`, 30, 3600); } catch { return go("/login"); }
  const auth = await getAuth();
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const out = go("/student");
  for (const c of res.headers.getSetCookie()) out.headers.append("set-cookie", c);
  return out;
}
