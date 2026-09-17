export const TOPICS: { id: string; g: number; n: string; w?: number }[];
export const G: Record<string, () => { text: string; ans: number[]; ordered?: boolean; hint: string }>;
export function withSeed<T>(seed: number, fn: () => T): T;
