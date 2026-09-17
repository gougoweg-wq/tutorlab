import { MASTERY, SAT, SM2 } from "./config";

/** Pure maths of docs/MASTERY-MODEL.md. No DB, no clock: time is always passed in. */
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));

export const difficultyToDelta = (difficulty: number) => (difficulty - 3) * MASTERY.difficultyStep;
export const expected = (theta: number, delta: number) => sigmoid(theta - delta);
export const kStudent = (n: number) => MASTERY.kStudent.base / Math.sqrt(1 + n / MASTERY.kStudent.scale);
export const kQuestion = (m: number) => MASTERY.kQuestion.base / Math.sqrt(1 + m / MASTERY.kQuestion.scale);

export function updateTheta(theta: number, delta: number, outcome: number, n: number, weight = 1): number {
  return round(clamp(theta + weight * kStudent(n) * (outcome - expected(theta, delta)), MASTERY.thetaClamp), MASTERY.thetaDecimals);
}
export function updateDifficulty(delta: number, theta: number, outcome: number, m: number): number {
  return round(clamp(delta - kQuestion(m) * (outcome - expected(theta, delta)), MASTERY.thetaClamp), MASTERY.deltaDecimals);
}
/** Knowledge fades toward "unknown" (θ = 0), never past it. */
export const decay = (theta: number, ageDays: number) => theta * 0.5 ** (Math.max(0, ageDays) / MASTERY.halfLifeDays);
export const masteryFromTheta = (thetaEff: number) => Math.round(100 * sigmoid(thetaEff));

export function confidenceInterval(thetaEff: number, n: number): { low: number; high: number } {
  const se = MASTERY.seBase / Math.sqrt(Math.max(n, 1));
  return { low: Math.round(100 * sigmoid(thetaEff - MASTERY.z * se)), high: Math.round(100 * sigmoid(thetaEff + MASTERY.z * se)) };
}

export type Status = "low_data" | "weak" | "in_progress" | "strong";
export function classify(x: { ciLow: number; ciHigh: number; n: number }): Status {
  if (x.n < MASTERY.minN) return "low_data";
  if (x.ciHigh < MASTERY.thresholds.weak) return "weak";
  if (x.ciLow > MASTERY.thresholds.strong) return "strong";
  return "in_progress";
}
export const forgettingRisk = (theta: number, ageDays: number) => theta > MASTERY.forgetting.theta && ageDays > MASTERY.forgetting.ageDays;

export type Observation = { delta: number; outcome: number; weight: number; at: Date };
/** Replays observations in order. Rebuilding from the log is what makes recordAttempt idempotent. */
export function replay(observations: Observation[]): { theta: number; n: number; nCorrect: number; lastAt: Date | null } {
  let theta = 0, n = 0, nCorrect = 0; let lastAt: Date | null = null;
  for (const o of observations) { theta = updateTheta(theta, o.delta, o.outcome, n, o.weight); n += 1; nCorrect += o.outcome; lastAt = o.at; }
  return { theta, n, nCorrect: round(nCorrect, 2), lastAt };
}

export function summarize(theta: number, n: number, lastAt: Date | null, now: Date) {
  const ageDays = lastAt ? (now.getTime() - lastAt.getTime()) / 86_400_000 : 0;
  const thetaEff = decay(theta, ageDays);
  const ci = confidenceInterval(thetaEff, n);
  return { thetaEff, mastery: masteryFromTheta(thetaEff), ciLow: ci.low, ciHigh: ci.high, ageDays, status: classify({ ciLow: ci.low, ciHigh: ci.high, n }), forgetting: forgettingRisk(theta, ageDays) };
}

export function sm2(prev: { intervalDays: number; ease: number; repetitions: number }, q: number) {
  const ease = Math.max(SM2.minEase, round(prev.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), 2));
  if (q < SM2.passQ) return { intervalDays: 1, ease, repetitions: 0 };
  const intervalDays = prev.repetitions < 2 ? SM2.firstIntervals[prev.repetitions] : Math.round(prev.intervalDays * prev.ease);
  return { intervalDays, ease, repetitions: prev.repetitions + 1 };
}

export function satSectionScore(domains: { code: string; mastery: number; n: number }[], section: "math" | "rw"): { score: number; margin: number } | null {
  let sum = 0, w = 0, seSum = 0, k = 0;
  for (const d of SAT.sections[section]) { const hit = domains.filter((x) => d.match.test(x.code) && x.n > 0); if (!hit.length) continue;
    const m = hit.reduce((s, x) => s + x.mastery, 0) / hit.length; sum += m * d.weight; w += d.weight; seSum += MASTERY.seBase / Math.sqrt(hit.reduce((s, x) => s + x.n, 0)); k += 1; }
  if (!w) return null;
  const score = Math.round((SAT.base + SAT.perPoint * (sum / w)) / 10) * 10;
  return { score: Math.max(SAT.min, Math.min(SAT.max, score)), margin: Math.round((SAT.marginBase + SAT.marginPerSe * (seSum / k)) / 10) * 10 };
}
