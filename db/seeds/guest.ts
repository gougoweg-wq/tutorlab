import fs from "node:fs";
import { and, eq, like } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { getDb, closeDb, schema, rows } from "@/db/client";
import { sql } from "drizzle-orm";
import { createTest } from "@/modules/assessments/service";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; }

/** Guest student in the owner's workspace with two demo tests assigned (school maths + SAT Math). */
async function main() {
  const email = process.env.GUEST_EMAIL ?? "guest@tutorlab.app", password = process.env.GUEST_PASSWORD ?? "guest";
  const db = await getDb();
  const [owner] = await db.select().from(schema.user).where(eq(schema.user.email, process.env.OWNER_EMAIL ?? ""));
  if (!owner) throw new Error("run npm run db:owner first");
  const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.ownerId, owner.id));
  let [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  const hash = await hashPassword(password);
  if (!u) { [u] = await db.insert(schema.user).values({ id: nanoid(32), email, name: "Гость", emailVerified: true }).returning(); await db.insert(schema.account).values({ id: nanoid(32), accountId: u.id, providerId: "credential", userId: u.id, password: hash }); }
  else await db.update(schema.account).set({ password: hash }).where(eq(schema.account.userId, u.id));
  await db.insert(schema.memberships).values({ workspaceId: ws.id, userId: u.id, role: "student" }).onConflictDoNothing();
  let [st] = await db.select().from(schema.students).where(and(eq(schema.students.userId, u.id), eq(schema.students.workspaceId, ws.id)));
  if (!st) [st] = await db.insert(schema.students).values({ workspaceId: ws.id, userId: u.id, displayName: "Гость", grade: 9, track: "mixed", subjects: ["MATH", "SAT"] }).returning();
  const has = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from assignments where student_id = ${st.id}`))[0].c;
  if (!has) {
    const pick = async (pattern: string) => (await db.select({ id: schema.topics.id }).from(schema.topics).where(like(schema.topics.code, pattern))).map((t) => t.id);
    const ctx = { user: { id: owner.id }, workspaceId: ws.id };
    const school = (await pick("MATH.8.T%")).slice(0, 5); const sat = await pick("SAT.MATH.%");
    const rule = (topicId: string, count: number) => ({ topicId, includeSubtree: true, count, difficultyMin: 1, difficultyMax: 5, types: null });
    await createTest(ctx, { title: "Демо: математика 8 класс", rules: school.map((t) => rule(t, 2)), studentIds: [st.id], dueAt: null, settings: { shuffleQuestions: false, shuffleOptions: true, timeLimitMin: null, maxAttempts: 5, showAnswers: "immediately", passPercent: 60, layout: "list" } });
    await createTest(ctx, { title: "Demo: SAT Math", rules: sat.map((t) => rule(t, 3)), studentIds: [st.id], dueAt: null, settings: { shuffleQuestions: false, shuffleOptions: true, timeLimitMin: 35, maxAttempts: 5, showAnswers: "immediately", passPercent: 60, layout: "list" } });
  }
  console.log(`guest ready: ${email}`);
  await closeDb();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
