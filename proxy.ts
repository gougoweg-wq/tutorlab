import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED = ["/tutor", "/student", "/parent", "/onboarding"];

/** Optimistic check only (cookie presence). Real authorization happens in layouts, actions and RLS. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req));
  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // behind a tunnel or reverse proxy req.url is the internal address; the Codespaces proxy even sends x-forwarded-host=localhost,
    // so the configured public URL wins and forwarded headers are the fallback
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    const url = new URL(`/login?next=${encodeURIComponent(pathname)}`, process.env.BETTER_AUTH_URL ?? `${proto}://${host}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/tutor/:path*", "/student/:path*", "/parent/:path*", "/onboarding"] };
