import { notFound, redirect } from "next/navigation";
import { requireStudentPage } from "@/modules/auth/context";
import { getAttemptForStudent } from "@/modules/assessments/service";
import { renderRich } from "@/ui/rich-text";
import { Player } from "@/modules/assessments/ui/player";
import { PracticePlayer } from "@/modules/assessments/ui/practice-player";
import { renderExplanationAction } from "@/modules/assessments/ui/render-action";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStudentPage();
  const a = await getAttemptForStudent(ctx, id).catch(() => null);
  if (!a) notFound();
  if (a.submitted) redirect(`/student/attempt/${id}/result`);
  const qs = a.questions.map((q) => ({ versionId: q.versionId, type: q.type === "single_choice" ? "single_choice" as const : "numeric" as const, stemHtml: renderRich(q.stemMd), expectedValues: q.expectedValues, unit: q.unit,
    choices: q.options?.kind === "choices" ? q.options.choices.map((c) => ({ id: c.id, html: renderRich(c.text) })) : undefined,
    draft: q.draft?.type === "numeric" ? q.draft.raw : q.draft?.type === "single_choice" ? (q.draft.choice ?? "") : "",
    checked: q.checked ? { isCorrect: q.checked.isCorrect, correct: q.checked.correct, explanationHtml: renderRich(q.checked.explanationMd) } : null }));
  if (a.instant && !a.deadlineAt) return <PracticePlayer attemptId={a.id} title={a.title} questions={qs} renderExplanation={renderExplanationAction} />;
  return <Player attemptId={a.id} title={a.title} deadlineAt={a.deadlineAt} serverNow={a.serverNow}
    questions={a.questions.map((q) => ({ versionId: q.versionId, type: q.type === "single_choice" ? "single_choice" as const : "numeric" as const, stemHtml: renderRich(q.stemMd), expectedValues: q.expectedValues, unit: q.unit,
      choices: q.options?.kind === "choices" ? q.options.choices.map((c) => ({ id: c.id, html: renderRich(c.text) })) : undefined,
      draft: q.draft?.type === "numeric" ? q.draft.raw : q.draft?.type === "single_choice" ? (q.draft.choice ?? "") : "" }))} />;
}
