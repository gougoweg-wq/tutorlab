import { notFound, redirect } from "next/navigation";
import { requireStudentPage } from "@/modules/auth/context";
import { getAttemptForStudent } from "@/modules/assessments/service";
import { renderRich } from "@/ui/rich-text";
import { Player } from "@/modules/assessments/ui/player";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStudentPage();
  const a = await getAttemptForStudent(ctx, id).catch(() => null);
  if (!a) notFound();
  if (a.submitted) redirect(`/student/attempt/${id}/result`);
  return <Player attemptId={a.id} title={a.title} deadlineAt={a.deadlineAt} serverNow={a.serverNow}
    questions={a.questions.map((q) => ({ versionId: q.versionId, stemHtml: renderRich(q.stemMd), expectedValues: q.expectedValues, unit: q.unit, draft: q.draft?.type === "numeric" ? q.draft.raw : "" }))} />;
}
