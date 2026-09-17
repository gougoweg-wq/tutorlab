import { and, eq, isNull, sql } from "drizzle-orm";
import { migrate } from "@/db/migrate";
import { getDb, closeDb, schema, rows } from "@/db/client";
import { TOPICS } from "@/modules/generators/legacy";
import { listGenerators, generateOne, topicCodeOf } from "@/modules/generators";
import { SAT_TOPICS } from "@/modules/generators/sat";
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
  let [sat] = await db.select().from(schema.subjects).where(and(eq(schema.subjects.code, "SAT"), isNull(schema.subjects.workspaceId)));
  if (!sat) [sat] = await db.insert(schema.subjects).values({ code: "SAT", name: { ru: "SAT", en: "SAT", uz: "SAT" }, sort: 9 }).returning();
  if (!existing.has("SAT.MATH")) { const [r] = await db.insert(schema.topics).values({ subjectId: sat.id, code: "SAT.MATH", name: { ru: "SAT Math", en: "SAT Math" }, grade: 12, depth: 0, sort: 100, isSat: true }).returning(); existing.set("SAT.MATH", r.id); }
  for (const [i, t] of SAT_TOPICS.entries()) if (!existing.has(t.code)) { const [r] = await db.insert(schema.topics).values({ subjectId: sat.id, parentId: existing.get("SAT.MATH")!, code: t.code, name: { ru: t.name, en: t.name }, grade: 12, depth: 1, sort: 101 + i, isSat: true }).returning(); existing.set(t.code, r.id); }
  console.log(`topics: ${existing.size}`);
  // bank
  {
    const seen = new Set<string>(); let inserted = 0;
    const mathSeeded = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from questions where workspace_id is null and language = 'ru'`))[0].c > 0;
    for (const g of listGenerators()) {
      const tag = `gen:${g.id}`;
      const has = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from questions where workspace_id is null and ${tag} = any(tags)`))[0].c;
      if (has > 0 || (!g.isSat && !g.id.endsWith("-mc") && mathSeeded)) continue;
      const drafts: ReturnType<typeof generateOne>[] = [];
      for (let i = 0; i < PER_GENERATOR * 3 && drafts.length < PER_GENERATOR; i++) {
        const d = generateOne(g.id, { seed: 1000 + i, difficulty: 2 + (i % 3) }); d.tags = [...d.tags, tag]; const h = contentHash(d.stemMd) + "|" + d.stemMd;
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
