import { describe, expect, it } from "vitest";
import katex from "katex";
import { listGenerators, generateOne } from "@/modules/generators";
import { scoreAnswer } from "@/modules/questions/scoring";
import type { AnswerPayload } from "@/modules/questions/types";

describe("generators", () => {
  const gens = listGenerators();
  it("covers school maths, SAT and multiple-choice twins", () => { expect(gens.length).toBeGreaterThan(100); expect(gens.some((g) => g.isSat)).toBe(true); expect(gens.some((g) => g.types[0] === "single_choice")).toBe(true); });
  it.each(gens.map((g) => g.id))("%s: valid, deterministic, self-consistent, renders", (id) => {
    const stems = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const q = generateOne(id, { seed }); stems.add(q.stemMd);
      expect(generateOne(id, { seed })).toEqual(q);
      expect(q.stemMd + q.explanationMd).not.toMatch(/NaN|undefined|Infinity/);
      for (const m of (q.stemMd + " " + q.explanationMd).matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(m[1], { throwOnError: true, strict: "ignore" })).not.toThrow();
      let payload: AnswerPayload;
      if (q.answer.type === "numeric") payload = { type: "numeric", raw: q.answer.values.map((v) => String(v).replace(".", ",")).join("; ") };
      else if (q.answer.type === "single_choice") { payload = { type: "single_choice", choice: q.answer.correct }; const texts = q.options!.kind === "choices" ? q.options!.choices.map((c) => c.text) : []; expect(new Set(texts).size).toBe(4); }
      else throw new Error("unexpected type");
      expect(scoreAnswer(q.answer, payload).isCorrect).toBe(true);
    }
    expect(stems.size).toBeGreaterThanOrEqual(3);
  });
});
