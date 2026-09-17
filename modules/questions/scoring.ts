import type { AnswerPayload, QuestionAnswer, ScoreResult } from "./types";
import { normalizeText, parseNumbers } from "./normalize";

const round2 = (n: number) => Math.round(n * 100) / 100;
const near = (a: number, b: number, tol: number, rel: number) => Math.abs(a - b) <= Math.max(tol, rel * Math.abs(b), 1e-9);

/**
 * Pure, deterministic scoring for every auto-gradable type. `weight` is the item's max score.
 * free_text returns needsReview=true with score 0 — it is graded by AI/tutor later.
 * A missing or mismatched payload scores 0.
 */
export function scoreAnswer(answer: QuestionAnswer, payload: AnswerPayload | null | undefined, weight = 1): ScoreResult {
  const zero: ScoreResult = { score: 0, maxScore: weight, isCorrect: false, needsReview: false };
  if (answer.type === "free_text") return { score: 0, maxScore: weight, isCorrect: null, needsReview: true };
  if (!payload || payload.type !== answer.type) return zero;
  let fraction = 0;

  switch (answer.type) {
    case "single_choice": {
      const p = payload as Extract<AnswerPayload, { type: "single_choice" }>;
      fraction = p.choice === answer.correct ? 1 : 0; break;
    }
    case "multiple_choice": {
      const p = payload as Extract<AnswerPayload, { type: "multiple_choice" }>;
      const correct = new Set(answer.correct); const chosen = new Set(p.choices);
      const hits = [...chosen].filter((c) => correct.has(c)).length; const wrong = chosen.size - hits;
      if (answer.partial) fraction = Math.max(0, (hits - wrong) / correct.size);
      else fraction = hits === correct.size && wrong === 0 ? 1 : 0;
      break;
    }
    case "numeric": {
      const p = payload as Extract<AnswerPayload, { type: "numeric" }>;
      const got = parseNumbers(p.raw);
      if (!got || got.length !== answer.values.length) { fraction = 0; break; }
      const tol = answer.tolerance ?? 1e-6, rel = answer.relTolerance ?? 0;
      if (answer.ordered) fraction = got.every((v, i) => near(v, answer.values[i], tol, rel)) ? 1 : 0;
      else { const a = [...got].sort((x, y) => x - y), b = [...answer.values].sort((x, y) => x - y); fraction = a.every((v, i) => near(v, b[i], tol, rel)) ? 1 : 0; }
      break;
    }
    case "short_text": {
      const p = payload as Extract<AnswerPayload, { type: "short_text" }>;
      const got = normalizeText(p.text, answer.normalize);
      fraction = got !== "" && answer.accepted.some((a) => normalizeText(a, answer.normalize) === got) ? 1 : 0; break;
    }
    case "matching": {
      const p = payload as Extract<AnswerPayload, { type: "matching" }>;
      const key = new Map(answer.pairs); const given = new Map(p.pairs);
      let hits = 0; for (const [l, r] of key) if (given.get(l) === r) hits += 1;
      fraction = hits / key.size; break;
    }
    case "ordering": {
      const p = payload as Extract<AnswerPayload, { type: "ordering" }>;
      fraction = p.order.length === answer.order.length && p.order.every((id, i) => id === answer.order[i]) ? 1 : 0; break;
    }
    case "cloze": {
      const p = payload as Extract<AnswerPayload, { type: "cloze" }>;
      const ids = Object.keys(answer.blanks); let hits = 0;
      for (const id of ids) {
        const got = normalizeText(p.blanks[id] ?? "", answer.normalize);
        const accepted = answer.blanks[id].map((a) => normalizeText(a, answer.normalize));
        const gotNum = parseNumbers(p.blanks[id] ?? "");
        const numericOk = gotNum?.length === 1 && answer.blanks[id].some((a) => { const n = parseNumbers(a); return n?.length === 1 && near(gotNum[0], n[0], 1e-6, 0); });
        if ((got !== "" && accepted.includes(got)) || numericOk) hits += 1;
      }
      fraction = ids.length ? hits / ids.length : 0; break;
    }
  }
  return { score: round2(fraction * weight), maxScore: weight, isCorrect: fraction >= 0.999, needsReview: false };
}

/** Human-readable correct answer for result pages (after submission only). */
export function describeAnswer(answer: QuestionAnswer, optionText: (id: string) => string): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000).replace(".", ",")).replace("-", "−");
  switch (answer.type) {
    case "single_choice": return optionText(answer.correct);
    case "multiple_choice": return answer.correct.map(optionText).join("; ");
    case "numeric": return answer.values.map(fmt).join("; ") + (answer.unit ? ` ${answer.unit}` : "");
    case "short_text": return answer.accepted[0];
    case "matching": return answer.pairs.map(([l, r]) => `${optionText(l)} → ${optionText(r)}`).join("; ");
    case "ordering": return answer.order.map(optionText).join(" → ");
    case "cloze": return Object.values(answer.blanks).map((v) => v[0]).join("; ");
    case "free_text": return answer.sample ?? "";
  }
}
