import type { PublicQuestion, QuestionAnswer, QuestionOptions, QuestionType } from "./types";

/** Student-safe projection of a question version. NEVER add answer/explanation/rubric here. */
export function toPublic(v: { id: string; stemMd: string; options: QuestionOptions | null; answer: QuestionAnswer }, type: QuestionType, optionOrder?: string[] | null): PublicQuestion {
  let options = v.options;
  if (options && optionOrder?.length) {
    const byOrder = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => optionOrder.indexOf(a.id) - optionOrder.indexOf(b.id));
    if (options.kind === "choices") options = { ...options, choices: byOrder(options.choices) };
    else if (options.kind === "ordering") options = { ...options, items: byOrder(options.items) };
    else if (options.kind === "matching") options = { ...options, right: byOrder(options.right) };
  }
  const a = v.answer;
  return {
    versionId: v.id, type, stemMd: v.stemMd, options,
    unit: a.type === "numeric" ? a.unit : undefined,
    expectedValues: a.type === "numeric" ? a.values.length : undefined,
  };
}
