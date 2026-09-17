"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { action, AppError } from "@/modules/shared/result";
import { getSessionUser, getContext, homeFor } from "./context";
import { acceptInvite } from "./invites";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";

export async function createWorkspaceAction(input: { name: string }) {
  return action(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("unauthorized");
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(input);
    const existing = await getContext();
    if (existing && (existing.role === "owner" || existing.role === "tutor")) return { workspaceId: existing.workspaceId };
    const db = await getDb();
    const workspaceId = await db.transaction(async (tx) => {
      const [ws] = await tx.insert(schema.workspaces).values({ name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`, ownerId: user.id }).returning({ id: schema.workspaces.id });
      await tx.insert(schema.memberships).values({ workspaceId: ws.id, userId: user.id, role: "owner" });
      return ws.id;
    });
    return { workspaceId };
  });
}

export async function acceptInviteAction(code: string) {
  const res = await action(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("unauthorized");
    return acceptInvite(code, user.id);
  });
  if (res.ok) redirect(homeFor(res.data.role));
  return res;
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getSessionUser();
  if (user) { const db = await getDb(); await db.update(schema.user).set({ locale }).where(eq(schema.user.id, user.id)); }
}

export async function setThemeAction(theme: "light" | "dark" | "system") {
  const c = await cookies();
  if (theme === "system") c.delete("theme"); else c.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
