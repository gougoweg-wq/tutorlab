"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { action, AppError } from "@/modules/shared/result";
import { requireTutor } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { createInvite } from "@/modules/auth/invites";
import { rateLimit } from "@/modules/shared/rate-limit";

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createStudentAction(input: unknown) {
  return action(async () => {
    const ctx = await requireTutor();
    const d = z.object({ name: z.string().trim().min(2).max(80), grade: z.coerce.number().int().min(5).max(11) }).parse(input);
    await rateLimit(`invite:${ctx.workspaceId}`, 40, 3600);
    const [st] = await withUser(ctx.user.id, (tx) => tx.insert(schema.students).values({ workspaceId: ctx.workspaceId, displayName: d.name, grade: d.grade, subjects: ["MATH"] }).returning({ id: schema.students.id }));
    const inv = await createInvite({ workspaceId: ctx.workspaceId, createdBy: ctx.user.id, role: "student", studentId: st.id });
    revalidatePath("/tutor/students");
    return { studentId: st.id, code: inv.code, link: `${base()}/invite/${inv.code}` };
  });
}

export async function newInviteAction(studentId: string) {
  return action(async () => {
    const ctx = await requireTutor();
    const [st] = await withUser(ctx.user.id, (tx) => tx.select({ id: schema.students.id, userId: schema.students.userId }).from(schema.students).where(and(eq(schema.students.id, studentId), eq(schema.students.workspaceId, ctx.workspaceId))));
    if (!st) throw new AppError("not_found");
    if (st.userId) throw new AppError("conflict");
    await rateLimit(`invite:${ctx.workspaceId}`, 40, 3600);
    const inv = await createInvite({ workspaceId: ctx.workspaceId, createdBy: ctx.user.id, role: "student", studentId: st.id });
    return { code: inv.code, link: `${base()}/invite/${inv.code}` };
  });
}
