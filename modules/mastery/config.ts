/** Every tunable constant of the mastery model (docs/MASTERY-MODEL.md). Nothing here touches the DB. */
export const MASTERY = {
  /** half-life of knowledge, days (§2) */
  halfLifeDays: 21,
  /** K_s = base / sqrt(1 + n / scale) (§1) */
  kStudent: { base: 0.9, scale: 4 },
  /** K_q = base / sqrt(1 + m / scale) (§1) */
  kQuestion: { base: 0.3, scale: 10 },
  /** δ = (difficulty − 3) · step (§1) */
  difficultyStep: 0.8,
  weights: { primary: 1, secondary: 0.5, parent: 0.5 },
  /** se = seBase / sqrt(max(n, 1)) (§3) */
  seBase: 1.2,
  z: 1.96,
  thresholds: { weak: 60, strong: 80 },
  /** below this number of answers a topic is "low data" and never weak */
  minN: 4,
  forgetting: { theta: 1.0, ageDays: 14 },
  /** θ and δ are persisted with this precision; rounding after every step keeps incremental == replay */
  thetaDecimals: 4,
  deltaDecimals: 3,
  thetaClamp: 6,
} as const;

export const RECOMMEND = {
  w: { weakness: 0.5, evidence: 0.2, forgetting: 0.2, dueReview: 0.1 },
  evidenceCap: 8,
  top: 3,
  practice: { total: 10, first: 6, second: 4 },
  /** δ ≈ θ_eff ± window (§5) */
  thetaWindow: 0.5,
  maxPrereqDepth: 5,
} as const;

export const SM2 = { initialEase: 2.5, minEase: 1.3, passQ: 3, firstIntervals: [1, 6] as const } as const;

export const TIMEZONE = "Asia/Tashkent";
export const TOP_N = 5;
export const ERROR_WINDOW_DAYS = 30;
export const WRONG_WINDOW_DAYS = 14;
export const GROWTH_WEEKS = 4;

export type SatSectionKey = "math" | "rw";
export type SatDomain = { key: string; weight: number; match: RegExp };
/**
 * Digital SAT domain weights (§7). A topic belongs to a domain when it is flagged `is_sat`
 * and its hierarchical code matches the pattern (codes look like SAT.MATH.ALGEBRA.LINEAR_EQUATIONS).
 */
export const SAT: { base: number; perPoint: number; min: number; max: number; marginBase: number; marginPerSe: number; sections: Record<SatSectionKey, SatDomain[]> } = {
  base: 200, perPoint: 6, min: 200, max: 800, marginBase: 40, marginPerSe: 200,
  sections: {
    math: [
      { key: "algebra", weight: 0.35, match: /(^|\.)(ALGEBRA|ALG|HEART_OF_ALGEBRA)(\.|$)/ },
      { key: "advanced", weight: 0.35, match: /(^|\.)(ADVANCED|ADVANCED_MATH|ADV|PASSPORT)(\.|$)/ },
      { key: "problem_solving", weight: 0.15, match: /(^|\.)(PROBLEM_SOLVING|PSDA|DATA|DATA_ANALYSIS)(\.|$)/ },
      { key: "geometry", weight: 0.15, match: /(^|\.)(GEOMETRY|GEOM|GEO|TRIG|GEOMETRY_TRIG|TRIGONOMETRY)(\.|$)/ },
    ],
    rw: [
      { key: "craft", weight: 0.28, match: /(^|\.)(CRAFT|CRAFT_STRUCTURE|CRAFT_AND_STRUCTURE)(\.|$)/ },
      { key: "information", weight: 0.26, match: /(^|\.)(INFORMATION|INFO|INFO_IDEAS|INFORMATION_AND_IDEAS)(\.|$)/ },
      { key: "conventions", weight: 0.26, match: /(^|\.)(CONVENTIONS|STANDARD_ENGLISH|SEC|GRAMMAR)(\.|$)/ },
      { key: "expression", weight: 0.2, match: /(^|\.)(EXPRESSION|EXPRESSION_OF_IDEAS|EOI)(\.|$)/ },
    ],
  },
};
