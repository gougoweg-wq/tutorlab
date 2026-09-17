import { describe, expect, it } from "vitest";
import { scoreAnswer } from "@/modules/questions/scoring";
import type { QuestionAnswer } from "@/modules/questions/types";
import { normalizeText, parseNumbers, contentHash } from "@/modules/questions/normalize";

describe("parseNumbers", () => {
  it("accepts decimals with comma, unicode minus, fractions and mixed numbers", () => {
    expect(parseNumbers("3,5")).toEqual([3.5]);
    expect(parseNumbers("−2")).toEqual([-2]);
    expect(parseNumbers("3/4")).toEqual([0.75]);
    expect(parseNumbers("1 1/2")).toEqual([1.5]);
    expect(parseNumbers("-1 1/2")).toEqual([-1.5]);
  });
  it("accepts several values and variable prefixes", () => {
    expect(parseNumbers("x = 2; x = 3")).toEqual([2, 3]);
    expect(parseNumbers("2 и 3")).toEqual([2, 3]);
    expect(parseNumbers("x1=-5;x2=1")).toEqual([-5, 1]);
  });
  it("strips trailing units but keeps fractions", () => {
    expect(parseNumbers("12 см")).toEqual([12]);
    expect(parseNumbers("25%")).toEqual([25]);
    expect(parseNumbers("7/2")).toEqual([3.5]);
  });
  it("rejects garbage", () => { expect(parseNumbers("два")).toBeNull(); expect(parseNumbers("")).toBeNull(); expect(parseNumbers("1/0")).toBeNull(); });
});

describe("normalizeText", () => {
  it("handles case, spaces and ё/е", () => { expect(normalizeText("  Ёжик   В  тумане ")).toBe("ежик в тумане"); });
  it("content hash ignores LaTeX and punctuation", () => { expect(contentHash("Решите: $x^2-5x+6=0$.")).toBe(contentHash("решите  $x^2-5x+6=0$")); });
});

describe("scoreAnswer", () => {
  it("single_choice", () => {
    const a = { type: "single_choice", correct: "b" } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "single_choice", choice: "b" }).isCorrect).toBe(true);
    expect(scoreAnswer(a, { type: "single_choice", choice: "a" }).score).toBe(0);
    expect(scoreAnswer(a, null).score).toBe(0);
  });
  it("multiple_choice partial credit never goes below zero", () => {
    const a = { type: "multiple_choice", correct: ["a", "c"], partial: true } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "multiple_choice", choices: ["a", "c"] }, 2).score).toBe(2);
    expect(scoreAnswer(a, { type: "multiple_choice", choices: ["a"] }, 2).score).toBe(1);
    expect(scoreAnswer(a, { type: "multiple_choice", choices: ["a", "b"] }, 2).score).toBe(0);
    expect(scoreAnswer(a, { type: "multiple_choice", choices: ["b", "d"] }, 2).score).toBe(0);
    expect(scoreAnswer({ type: "multiple_choice", correct: ["a", "c"], partial: false }, { type: "multiple_choice", choices: ["a"] }).score).toBe(0);
  });
  it("numeric: set of roots in any order, tolerance, fractions", () => {
    const roots = { type: "numeric", values: [2, 3], tolerance: 1e-6, relTolerance: 0, ordered: false } as QuestionAnswer;
    expect(scoreAnswer(roots, { type: "numeric", raw: "3; 2" }).isCorrect).toBe(true);
    expect(scoreAnswer(roots, { type: "numeric", raw: "2" }).isCorrect).toBe(false);
    const third = { type: "numeric", values: [1 / 3], tolerance: 0.001, relTolerance: 0, ordered: false } as QuestionAnswer;
    expect(scoreAnswer(third, { type: "numeric", raw: "1/3" }).isCorrect).toBe(true);
    expect(scoreAnswer(third, { type: "numeric", raw: "0,333" }).isCorrect).toBe(true);
    expect(scoreAnswer(third, { type: "numeric", raw: "0,3" }).isCorrect).toBe(false);
    const ordered = { type: "numeric", values: [1, -2], tolerance: 1e-6, relTolerance: 0, ordered: true } as QuestionAnswer;
    expect(scoreAnswer(ordered, { type: "numeric", raw: "-2; 1" }).isCorrect).toBe(false);
  });
  it("short_text with normalisation", () => {
    const a = { type: "short_text", accepted: ["Ёлка"], normalize: { case: true, spaces: true, yo: true, punctuation: false } } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "short_text", text: "  елка " }).isCorrect).toBe(true);
    expect(scoreAnswer(a, { type: "short_text", text: "" }).isCorrect).toBe(false);
  });
  it("matching gives credit per pair", () => {
    const a = { type: "matching", pairs: [["1", "a"], ["2", "b"], ["3", "c"], ["4", "d"]] } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "matching", pairs: [["1", "a"], ["2", "b"], ["3", "d"], ["4", "c"]] }, 4).score).toBe(2);
  });
  it("ordering is all-or-nothing", () => {
    const a = { type: "ordering", order: ["x", "y", "z"] } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "ordering", order: ["x", "y", "z"] }).isCorrect).toBe(true);
    expect(scoreAnswer(a, { type: "ordering", order: ["y", "x", "z"] }).score).toBe(0);
  });
  it("cloze accepts text and numeric equivalents per blank", () => {
    const a = { type: "cloze", blanks: { "1": ["0.5", "1/2"], "2": ["went"] }, normalize: { case: true, spaces: true, yo: true, punctuation: false } } as QuestionAnswer;
    expect(scoreAnswer(a, { type: "cloze", blanks: { "1": "0,5", "2": "Went" } }, 2).score).toBe(2);
    expect(scoreAnswer(a, { type: "cloze", blanks: { "1": "2/4", "2": "goed" } }, 2).score).toBe(1);
  });
  it("free_text is never auto-graded", () => {
    const r = scoreAnswer({ type: "free_text", maxPoints: 5 }, { type: "free_text", text: "..." }, 5);
    expect(r.needsReview).toBe(true); expect(r.isCorrect).toBeNull();
  });
  it("mismatched payload type scores zero", () => { expect(scoreAnswer({ type: "single_choice", correct: "a" }, { type: "numeric", raw: "1" }).score).toBe(0); });
});
