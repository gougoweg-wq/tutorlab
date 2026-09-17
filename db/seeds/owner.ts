import fs from "node:fs";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { migrate } from "@/db/migrate";
import { getDb, closeDb, schema } from "@/db/client";

/** Creates (or resets the password of) the owner account from OWNER_* env vars and gives it a workspace. */
for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  const email = process.env.OWNER_EMAIL, password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD in .env.local");
  await migrate();
  const db = await getDb();
  const hash = await hashPassword(password);
  let [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!u) {
    [u] = await db.insert(schema.user).values({ id: nanoid(32), email, name: process.env.OWNER_NAME ?? "Admin", emailVerified: true }).returning();
    await db.insert(schema.account).values({ id: nanoid(32), accountId: u.id, providerId: "credential", userId: u.id, password: hash });
  } else {
    await db.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(eq(schema.account.userId, u.id));
  }
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, u.id));
  if (!m) {
    const [ws] = await db.insert(schema.workspaces).values({ name: process.env.OWNER_WORKSPACE ?? "TutorLab", slug: `main-${nanoid(6).toLowerCase()}`, ownerId: u.id }).returning();
    await db.insert(schema.memberships).values({ workspaceId: ws.id, userId: u.id, role: "owner" });
  }
  console.log(`owner ready: ${email}`);
  await closeDb();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
