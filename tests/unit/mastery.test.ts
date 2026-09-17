import { describe, expect, it } from "vitest";
import { replay, summarize, classify, confidenceInterval, decay, sm2, updateTheta, difficultyToDelta, satSectionScore, type Observation } from "@/modules/mastery/model";

const t0 = new Date("2026-01-01T00:00:00Z");
const obs = (outcomes: number[], difficulty = 3): Observation[] => outcomes.map((o, i) => ({ outcome: o, delta: difficultyToDelta(difficulty), weight: 1, at: new Date(t0.getTime() + i * 60_000) }));
const at = (days: number) => new Date(t0.getTime() + days * 86_400_000);

describe("mastery model (docs/MASTERY-MODEL.md §8)", () => {
  it("1. ten correct answers at difficulty 3 → mastery > 75 and the interval narrows monotonically", () => {
    const r = replay(obs(Array(10).fill(1))); expect(summarize(r.theta, r.n, r.lastAt, at(0)).mastery).toBeGreaterThan(75);
    let prev = Infinity; for (let n = 1; n <= 30; n++) { const ci = confidenceInterval(0.5, n); expect(ci.high - ci.low).toBeLessThanOrEqual(prev); prev = ci.high - ci.low; }
  });
  it("2. ten wrong answers → mastery < 25", () => { const r = replay(obs(Array(10).fill(0))); expect(summarize(r.theta, r.n, r.lastAt, at(0)).mastery).toBeLessThan(25); });
  it("3. alternating answers stay in the 40–60 band", () => { const r = replay(obs([1, 0, 1, 0, 1, 0, 1, 0, 1, 0])); const m = summarize(r.theta, r.n, r.lastAt, at(0)).mastery; expect(m).toBeGreaterThanOrEqual(40); expect(m).toBeLessThanOrEqual(60); });
  it("4. a correct answer on a hard question moves θ more than on an easy one", () => { expect(updateTheta(0, difficultyToDelta(5), 1, 3)).toBeGreaterThan(updateTheta(0, difficultyToDelta(1), 1, 3)); });
  it("5. after 42 idle days a strong topic fades toward unknown: below 75, flagged as forgetting, never weak", () => {
    const r = replay(obs(Array(20).fill(1), 4)); const fresh = summarize(r.theta, r.n, r.lastAt, at(0)); const old = summarize(r.theta, r.n, r.lastAt, at(42));
    expect(fresh.mastery).toBeGreaterThan(85); expect(old.mastery).toBeLessThan(75); expect(old.mastery).toBeGreaterThanOrEqual(50); expect(old.forgetting).toBe(true); expect(old.status).not.toBe("weak");
  });
  it("decay moves toward 0 and never crosses it", () => { expect(decay(-2, 1000)).toBeLessThanOrEqual(0); expect(decay(2, 1000)).toBeGreaterThanOrEqual(0); expect(Math.abs(decay(2, 21))).toBeCloseTo(1, 5); });
  it("6. fewer than four answers is never 'weak'", () => { for (let n = 0; n < 4; n++) expect(classify({ ciLow: 0, ciHigh: 5, n })).toBe("low_data"); expect(classify({ ciLow: 0, ciHigh: 5, n: 4 })).toBe("weak"); });
  it("8. SM-2: three good reviews give 1, 6, ~15 days; a failure resets", () => {
    let s = { intervalDays: 1, ease: 2.5, repetitions: 0 }; const seq: number[] = [];
    for (let i = 0; i < 3; i++) { s = sm2(s, 5); seq.push(s.intervalDays); }
    expect(seq[0]).toBe(1); expect(seq[1]).toBe(6); expect(seq[2]).toBeGreaterThanOrEqual(15); expect(sm2(s, 1)).toMatchObject({ intervalDays: 1, repetitions: 0 });
  });
  it("9. replay is deterministic, so incremental state equals a rebuild from the log", () => { const o = obs([1, 1, 0, 1, 0, 0, 1, 1]); expect(replay(o)).toEqual(replay([...o])); });
  it("SAT forecast stays inside 200–800 and carries a margin", () => {
    const hi = satSectionScore([{ code: "SAT.MATH.ALGEBRA", mastery: 100, n: 50 }], "math")!; const lo = satSectionScore([{ code: "SAT.MATH.ALGEBRA", mastery: 0, n: 50 }], "math")!;
    expect(hi.score).toBeLessThanOrEqual(800); expect(lo.score).toBeGreaterThanOrEqual(200); expect(hi.margin).toBeGreaterThanOrEqual(40); expect(satSectionScore([], "math")).toBeNull();
  });
});
