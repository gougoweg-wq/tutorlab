import { and, eq, isNull, sql } from "drizzle-orm";
import { migrate } from "@/db/migrate";
import { getDb, closeDb, schema, rows } from "@/db/client";
import { TOPICS } from "@/modules/generators/legacy";
import { listGenerators, generateOne, topicCodeOf } from "@/modules/generators";
import { insertQuestion } from "@/modules/questions/repo";
import { contentHash } from "@/modules/questions/normalize";

const PER_GENERATOR = Number(process.env.SEED_PER_GENERATOR ?? 120);

async function main() {
  await migrate();
  const db = await getDb();
  // catalog
  let [subj] = await db.select().from(schema.subjects).where(and(eq(schema.subjects.code, "MATH"), isNull(schema.subjects.workspaceId)));
  if (!subj) [subj] = await db.insert(schema.subjects).values({ code: "MATH", name: { ru: "Математика", en: "Mathematics", uz: "Matematika" }, sort: 1 }).returning();
  const existing = new Map((await db.select().from(schema.topics).where(isNull(schema.topics.workspaceId))).map((t) => [t.code, t.id]));
  for (const g of [6, 7, 8, 9]) {
    const code = `MATH.${g}`;
    if (!existing.has(code)) { const [r] = await db.insert(schema.topics).values({ subjectId: subj.id, code, name: { ru: `${g} класс`, en: `Grade ${g}`, uz: `${g}-sinf` }, grade: g, depth: 0, sort: g }).returning(); existing.set(code, r.id); }
  }
  let sort = 0;
  for (const t of TOPICS) {
    const code = topicCodeOf(t.id);
    if (!existing.has(code)) { const [r] = await db.insert(schema.topics).values({ subjectId: subj.id, parentId: existing.get(`MATH.${t.g}`)!, code, name: { ru: t.n }, grade: t.g, depth: 1, sort: sort++, generatorId: `math-${t.id}` }).returning(); existing.set(code, r.id); }
  }
  console.log(`topics: ${existing.size}`);
  // bank
  const have = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from questions where workspace_id is null`))[0].c;
  const target = listGenerators().length * PER_GENERATOR * 0.8;
  if (have >= target) { console.log(`bank already seeded: ${have}`); }
  else {
    const seen = new Set<string>(); let inserted = 0;
    for (const g of listGenerators()) {
      const drafts: ReturnType<typeof generateOne>[] = [];
      for (let i = 0; i < PER_GENERATOR * 3 && drafts.length < PER_GENERATOR; i++) {
        const d = generateOne(g.id, { seed: 1000 + i, difficulty: 2 + (i % 3) }); const h = contentHash(d.stemMd) + "|" + d.stemMd;
        if (!seen.has(h)) { seen.add(h); drafts.push(d); }
      }
      await db.transaction(async (tx) => { for (const d of drafts) await insertQuestion(tx, { workspaceId: null, draft: d, source: "generator", status: "published" }); });
      inserted += drafts.length; console.log(`${g.id}: +${drafts.length} (${inserted})`);
    }
    console.log(`bank: ${inserted} questions`);
  }
  await closeDb();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
