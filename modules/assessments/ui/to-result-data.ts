import { renderRich } from "@/ui/rich-text";
import type { ResultData } from "./result-view";
import type { getResult } from "../service";

export function toResultData(r: Awaited<ReturnType<typeof getResult>>): ResultData {
  return { title: r.title, student: r.student, percent: r.percent, passPercent: r.passPercent, topics: r.topics,
    items: r.items.map((i) => ({ id: i.id, stemHtml: renderRich(i.stemMd), explanationHtml: i.explanationMd ? renderRich(i.explanationMd) : null, topic: i.topic, given: i.given, isCorrect: i.isCorrect, correct: i.correct })) };
}
