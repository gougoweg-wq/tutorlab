import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED = ["/tutor", "/student", "/parent", "/onboarding"];

/** Optimistic check only (cookie presence). Real authorization happens in layouts, actions and RLS. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req));
  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // relative Location keeps the public host when running behind a tunnel or reverse proxy
    return new NextResponse(null, { status: 307, headers: { location: `/login?next=${encodeURIComponent(pathname)}` } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/tutor/:path*", "/student/:path*", "/parent/:path*", "/onboarding"] };
