import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb, schema } from "@/db/client";
import { AppError } from "@/modules/shared/result";

export type Role = "owner" | "tutor" | "student" | "parent";
export type SessionUser = { id: string; name: string; email: string; image?: string | null; locale: string };
export type AppContext = {
  user: SessionUser;
  workspaceId: string;
  workspaceName: string;
  role: Role;
  /** set when role = student */
  studentId: string | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { locale?: string };
  return { id: u.id, name: u.name, email: u.email, image: u.image, locale: u.locale ?? "ru" };
});

/** Active membership: tutor/owner membership wins over student (a tutor may also be someone's student). */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const db = await getDb();
  const ms = await db.select({ workspaceId: schema.memberships.workspaceId, role: schema.memberships.role, name: schema.workspaces.name })
    .from(schema.memberships).innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(eq(schema.memberships.userId, user.id));
  if (!ms.length) return null;
  const order: Role[] = ["owner", "tutor", "student", "parent"];
  ms.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const m = ms[0];
  let studentId: string | null = null;
  if (m.role === "student") {
    const [st] = await db.select({ id: schema.students.id }).from(schema.students)
      .where(and(eq(schema.students.userId, user.id), eq(schema.students.workspaceId, m.workspaceId), isNull(schema.students.archivedAt)));
    studentId = st?.id ?? null;
  }
  return { user, workspaceId: m.workspaceId, workspaceName: m.name, role: m.role, studentId };
});

export const homeFor = (role: Role) => (role === "student" ? "/student" : role === "parent" ? "/parent" : "/tutor");

/** For pages/layouts: redirects instead of throwing. */
export async function requirePage(...roles: Role[]): Promise<AppContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");
  if (roles.length && !roles.includes(ctx.role)) redirect(homeFor(ctx.role));
  return ctx;
}
export const requireTutorPage = () => requirePage("owner", "tutor");
export const requireStudentPage = async () => {
  const ctx = await requirePage("student");
  if (!ctx.studentId) redirect("/onboarding");
  return ctx as AppContext & { studentId: string };
};

/** For server actions: throws AppError (converted to a typed failure by `action()`). */
export async function requireCtx(...roles: Role[]): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) throw new AppError("unauthorized");
  if (roles.length && !roles.includes(ctx.role)) throw new AppError("forbidden");
  return ctx;
}
export const requireTutor = () => requireCtx("owner", "tutor");
export async function requireStudent(): Promise<AppContext & { studentId: string }> {
  const ctx = await requireCtx("student");
  if (!ctx.studentId) throw new AppError("forbidden");
  return ctx as AppContext & { studentId: string };
}
