import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/db/client";
import { AppError } from "@/modules/shared/result";

const code = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export type InviteInfo = { code: string; workspaceId: string; workspaceName: string; tutorName: string; role: "student" | "parent" | "tutor" | "owner"; studentId: string | null; studentName: string | null };

export async function createInvite(input: { workspaceId: string; createdBy: string; role: "student" | "parent"; studentId: string | null; ttlDays?: number }) {
  const db = await getDb();
  const [row] = await db.insert(schema.invites).values({
    workspaceId: input.workspaceId, createdBy: input.createdBy, role: input.role, studentId: input.studentId,
    code: code(), expiresAt: new Date(Date.now() + (input.ttlDays ?? 14) * 86_400_000),
  }).returning();
  return row;
}

/** Valid = exists, not used, not expired. */
export async function getInvite(inviteCode: string): Promise<InviteInfo | null> {
  const db = await getDb();
  const [row] = await db.select({
    code: schema.invites.code, workspaceId: schema.invites.workspaceId, role: schema.invites.role, studentId: schema.invites.studentId,
    workspaceName: schema.workspaces.name, tutorName: schema.user.name, studentName: schema.students.displayName,
  }).from(schema.invites)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.invites.workspaceId))
    .innerJoin(schema.user, eq(schema.user.id, schema.workspaces.ownerId))
    .leftJoin(schema.students, eq(schema.students.id, schema.invites.studentId))
    .where(and(eq(schema.invites.code, inviteCode.trim().toUpperCase()), isNull(schema.invites.usedAt), gt(schema.invites.expiresAt, new Date())));
  return row ?? null;
}

/** One-time: links the signed-in user to the workspace (and to the student profile / parent link). */
export async function acceptInvite(inviteCode: string, userId: string): Promise<{ role: InviteInfo["role"] }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(schema.invites)
      .where(and(eq(schema.invites.code, inviteCode.trim().toUpperCase()), isNull(schema.invites.usedAt), gt(schema.invites.expiresAt, new Date())));
    if (!inv) throw new AppError("not_found");
    await tx.insert(schema.memberships).values({ workspaceId: inv.workspaceId, userId, role: inv.role }).onConflictDoNothing();
    if (inv.role === "student" && inv.studentId) {
      const [st] = await tx.select({ userId: schema.students.userId }).from(schema.students).where(eq(schema.students.id, inv.studentId));
      if (st?.userId && st.userId !== userId) throw new AppError("conflict");
      await tx.update(schema.students).set({ userId, updatedAt: new Date() }).where(eq(schema.students.id, inv.studentId));
    }
    if (inv.role === "parent" && inv.studentId) {
      await tx.insert(schema.parentLinks).values({ parentUserId: userId, studentId: inv.studentId, workspaceId: inv.workspaceId }).onConflictDoNothing();
    }
    await tx.update(schema.invites).set({ usedBy: userId, usedAt: new Date() }).where(eq(schema.invites.id, inv.id));
    return { role: inv.role };
  });
}
