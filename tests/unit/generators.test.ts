import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import { describe, expect, it } from "vitest";
import { listGenerators, getGenerator, generateOne, generateWithCheck, generateForTopic, PACKS } from "@/modules/generators";
import { questionDraftSchema, AUTO_TYPES, type AnswerPayload, type QuestionDraft } from "@/modules/questions/types";
import { scoreAnswer } from "@/modules/questions/scoring";
import { contentHash } from "@/modules/questions/normalize";

const SEEDS = 40;
/** GEN_PACK=physics narrows the run to one pack (key of PACKS) while it is being written. */
const only = process.env.GEN_PACK;
const metas = only ? (PACKS[only] ?? []).map((g) => g.meta) : listGenerators();

type SeedTopic = { code: string };
const seedDir = path.join(process.cwd(), "db/seeds/curriculum");
const topicCodes = new Set<string>();
for (const f of fs.existsSync(seedDir) ? fs.readdirSync(seedDir).filter((x) => x.endsWith(".json")) : []) {
  for (const t of (JSON.parse(fs.readFileSync(path.join(seedDir, f), "utf8")) as { topics: SeedTopic[] }).topics) topicCodes.add(t.code);
}

const fmtValue = (n: number) => String(n).replace(".", ",");

function correctPayload(q: QuestionDraft): AnswerPayload {
  const a = q.answer;
  switch (a.type) {
    case "single_choice": return { type: "single_choice", choice: a.correct };
    case "multiple_choice": return { type: "multiple_choice", choices: a.correct };
    case "numeric": return { type: "numeric", raw: a.values.map(fmtValue).join("; ") };
    case "short_text": return { type: "short_text", text: a.accepted[0] };
    case "matching": return { type: "matching", pairs: a.pairs };
    case "ordering": return { type: "ordering", order: a.order };
    case "cloze": return { type: "cloze", blanks: Object.fromEntries(Object.entries(a.blanks).map(([k, v]) => [k, v[0]])) };
    case "free_text": return { type: "free_text", text: a.sample ?? "" };
  }
}

function mathSegments(md: string): string[] {
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g;
  for (let m = re.exec(md); m; m = re.exec(md)) out.push((m[1] ?? m[2]).trim());
  return out;
}

function assertStructure(q: QuestionDraft, label: string) {
  const bad = /NaN|undefined|Infinity|\[object/;
  expect(bad.test(q.stemMd), `${label}: stem ${q.stemMd}`).toBe(false);
  expect(bad.test(q.explanationMd), `${label}: explanation ${q.explanationMd}`).toBe(false);
  expect(q.explanationMd.trim().length, `${label}: explanation is empty`).toBeGreaterThan(10);
  expect(AUTO_TYPES.includes(q.type), `${label}: type ${q.type} is not auto-gradable`).toBe(true);
  // an odd number of "$" means a broken formula or a currency sign that the renderer would treat as math
  expect((q.stemMd.match(/\$/g) ?? []).length % 2, `${label}: unbalanced $ in stem: ${q.stemMd}`).toBe(0);
  expect((q.explanationMd.match(/\$/g) ?? []).length % 2, `${label}: unbalanced $ in explanation: ${q.explanationMd}`).toBe(0);
  const a = q.answer;
  const texts = (items: { id: string; text: string }[]) => {
    expect(new Set(items.map((i) => i.id)).size, `${label}: duplicate option ids`).toBe(items.length);
    expect(new Set(items.map((i) => i.text.trim())).size, `${label}: duplicate option texts ${items.map((i) => i.text).join(" | ")}`).toBe(items.length);
    for (const i of items) expect(bad.test(i.text), `${label}: option ${i.text}`).toBe(false);
  };
  if (a.type === "numeric") {
    for (const v of a.values) expect(Number.isFinite(v), `${label}: value ${v}`).toBe(true);
    expect(q.options, `${label}: numeric question must not carry options`).toBeUndefined();
  } else if (a.type === "single_choice" || a.type === "multiple_choice") {
    expect(q.options?.kind, label).toBe("choices");
    if (q.options?.kind !== "choices") return;
    texts(q.options.choices);
    const ids = new Set(q.options.choices.map((c) => c.id));
    const correct = a.type === "single_choice" ? [a.correct] : a.correct;
    for (const c of correct) expect(ids.has(c), `${label}: correct id ${c} is not an option`).toBe(true);
    if (a.type === "single_choice") { expect(q.options.choices.length, `${label}: 4 options expected`).toBe(4); expect(q.options.choices.map((c) => c.id), label).toEqual(["a", "b", "c", "d"]); }
    else { expect(new Set(a.correct).size, label).toBe(a.correct.length); expect(a.correct.length, `${label}: every option is correct`).toBeLessThan(q.options.choices.length); }
  } else if (a.type === "matching") {
    expect(q.options?.kind, label).toBe("matching");
    if (q.options?.kind !== "matching") return;
    texts(q.options.left); texts(q.options.right);
    const l = new Set(q.options.left.map((x) => x.id)), r = new Set(q.options.right.map((x) => x.id));
    expect(a.pairs.length, label).toBe(q.options.left.length);
    for (const [x, y] of a.pairs) { expect(l.has(x), `${label}: left id ${x}`).toBe(true); expect(r.has(y), `${label}: right id ${y}`).toBe(true); }
  } else if (a.type === "ordering") {
    expect(q.options?.kind, label).toBe("ordering");
    if (q.options?.kind !== "ordering") return;
    texts(q.options.items);
    expect([...a.order].sort(), label).toEqual(q.options.items.map((i) => i.id).sort());
  } else if (a.type === "cloze") {
    expect(q.options?.kind, label).toBe("cloze");
    if (q.options?.kind !== "cloze") return;
    const ids = q.options.blanks.map((b) => b.id);
    expect(Object.keys(a.blanks).sort(), label).toEqual([...ids].sort());
    for (const id of ids) expect(q.stemMd.includes(`{{${id}}}`), `${label}: stem lacks {{${id}}}`).toBe(true);
    for (const seg of mathSegments(q.stemMd)) expect(seg.includes("{{"), `${label}: blank inside a formula`).toBe(false);
  } else if (a.type === "short_text") {
    expect(a.accepted.every((s) => s.trim().length > 0), label).toBe(true);
  }
}

describe("generator registry", () => {
  it("has unique ids, valid metadata and a seeded topic for every generator", () => {
    const all = listGenerators();
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
    for (const m of all) {
      expect(getGenerator(m.id)).toEqual(m);
      expect(m.id).toMatch(/^[a-z0-9_.-]+$/);
      expect(m.title.ru.length).toBeGreaterThan(2);
      expect(topicCodes.has(m.topicCode), `${m.id}: topic ${m.topicCode} is missing from db/seeds/curriculum`).toBe(true);
      if (m.isSat) { expect(m.language).toBe("en"); expect(m.topicCode.startsWith("SAT.")).toBe(true); }
    }
  });

  it.skipIf(Boolean(only))("meets the coverage targets", () => {
    const all = listGenerators();
    const count = (f: (m: (typeof all)[number]) => boolean) => all.filter(f).length;
    expect(count((m) => m.topicCode.startsWith("MATH.") && !m.wordProblem)).toBeGreaterThanOrEqual(95);
    expect(count((m) => m.wordProblem)).toBeGreaterThanOrEqual(22);
    expect(count((m) => m.topicCode.startsWith("SAT.MATH."))).toBeGreaterThanOrEqual(24);
    expect(count((m) => m.topicCode.startsWith("PHYS."))).toBeGreaterThanOrEqual(16);
    expect(count((m) => m.topicCode.startsWith("CHEM."))).toBeGreaterThanOrEqual(7);
    expect(count((m) => m.topicCode.startsWith("ENG."))).toBeGreaterThanOrEqual(9);
    expect(count((m) => m.topicCode.startsWith("RUS."))).toBeGreaterThanOrEqual(7);
    expect(count((m) => m.types.some((t) => t !== "numeric")) / all.length).toBeGreaterThanOrEqual(0.25);
    for (const t of AUTO_TYPES) expect(count((m) => m.types.includes(t)), `no generator produces ${t}`).toBeGreaterThan(0);
  });
});

describe.each(metas.map((m) => [m.id, m] as const))("generator %s", (id, meta) => {
  const runs: { difficulty: number; seed: number; q: QuestionDraft; check?: () => boolean }[] = [];
  for (const difficulty of meta.difficulties) for (let seed = 1; seed <= SEEDS; seed++) {
    const g = generateWithCheck(id, { seed, difficulty });
    runs.push({ difficulty, seed, q: g.draft, check: g.check });
  }

  it("produces valid, well-formed drafts", () => {
    for (const { q, difficulty, seed } of runs) {
      const label = `${id} d${difficulty} s${seed}`;
      expect(() => questionDraftSchema.parse(q), label).not.toThrow();
      expect(q.difficulty).toBe(difficulty);
      expect(q.topicCodes[0]).toBe(meta.topicCode);
      expect(q.language).toBe(meta.language);
      expect(meta.types.includes(q.type), `${label}: undeclared type ${q.type}`).toBe(true);
      assertStructure(q, label);
    }
  });

  it("the correct answer scores full marks", () => {
    for (const { q, difficulty, seed } of runs) {
      const res = scoreAnswer(q.answer, correctPayload(q), 1);
      expect(res.isCorrect, `${id} d${difficulty} s${seed}: ${q.stemMd} → ${JSON.stringify(q.answer)}`).toBe(true);
      expect(res.score).toBe(1);
    }
  });

  it("is deterministic and varied", () => {
    for (const difficulty of meta.difficulties) {
      expect(generateOne(id, { seed: 7, difficulty })).toEqual(generateOne(id, { seed: 7, difficulty }));
      const stems = new Set(runs.filter((r) => r.difficulty === difficulty).map((r) => contentHash(r.q.stemMd)));
      expect(stems.size, `${id} d${difficulty}: only ${stems.size} distinct stems in ${SEEDS} seeds`).toBeGreaterThanOrEqual(12);
    }
    expect(generateOne(id, { seed: 11 })).toEqual(generateOne(id, { seed: 11 }));
  });

  it("renders every formula with KaTeX", () => {
    for (const { q, difficulty, seed } of runs) {
      const texts = [q.stemMd, q.explanationMd];
      if (q.options?.kind === "choices") texts.push(...q.options.choices.map((c) => c.text));
      if (q.options?.kind === "ordering") texts.push(...q.options.items.map((c) => c.text));
      if (q.options?.kind === "matching") texts.push(...q.options.left.map((c) => c.text), ...q.options.right.map((c) => c.text));
      for (const t of texts) for (const seg of mathSegments(t)) {
        expect(() => katex.renderToString(seg, { throwOnError: true, strict: "error" }), `${id} d${difficulty} s${seed}: $${seg}$`).not.toThrow();
      }
    }
  });

  it("passes its independent self-check", () => {
    for (const { check, difficulty, seed, q } of runs) if (check) expect(check(), `${id} d${difficulty} s${seed}: ${q.stemMd} → ${JSON.stringify(q.answer)}`).toBe(true);
  });
});

describe.skipIf(Boolean(only))("self-check coverage", () => {
  it("at least 70% of numeric maths/physics/chemistry generators verify their answer independently", () => {
    const stem = listGenerators().filter((m) => /^(MATH|PHYS|CHEM|SAT\.MATH)\./.test(m.topicCode) && m.types.includes("numeric"));
    const withCheck = stem.filter((m) => Boolean(generateWithCheck(m.id, { seed: 1 }).check));
    expect(withCheck.length / stem.length).toBeGreaterThanOrEqual(0.7);
  });
});

describe.skipIf(Boolean(only))("generateForTopic", () => {
  it("covers a subtree, honours the difficulty window and never repeats a stem", () => {
    const qs = generateForTopic("MATH.8", 60, { seed: 3, difficultyMin: 2, difficultyMax: 4 });
    expect(qs.length).toBe(60);
    expect(new Set(qs.map((q) => contentHash(q.stemMd))).size).toBe(60);
    for (const q of qs) { expect(q.topicCodes[0].startsWith("MATH.8.")).toBe(true); expect(q.difficulty).toBeGreaterThanOrEqual(2); expect(q.difficulty).toBeLessThanOrEqual(4); }
    expect(new Set(qs.map((q) => q.topicCodes[0])).size).toBeGreaterThan(5);
    expect(generateForTopic("MATH.8", 10, { seed: 3 })).toEqual(generateForTopic("MATH.8", 10, { seed: 3 }));
    expect(generateForTopic("NO.SUCH.TOPIC", 5, { seed: 1 })).toEqual([]);
    expect(() => generateOne("no.such.generator", { seed: 1 })).toThrow();
  });
  it("does not match sibling topics that merely share a prefix string", () => {
    for (const q of generateForTopic("MATH.1", 5, { seed: 1 })) expect(q.topicCodes[0].startsWith("MATH.1.")).toBe(true);
  });
});
