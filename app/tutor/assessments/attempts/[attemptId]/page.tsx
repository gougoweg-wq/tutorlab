import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireTutorPage } from "@/modules/auth/context";
import { getResult } from "@/modules/assessments/service";
import { toResultData } from "@/modules/assessments/ui/to-result-data";
import { ResultView } from "@/modules/assessments/ui/result-view";

export default async function TutorAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const ctx = await requireTutorPage();
  const r = await getResult(ctx, attemptId, await getLocale()).catch(() => null);
  if (!r) notFound();
  return (<div><p className="t-eyebrow mb-3">{r.student}</p><ResultView data={toResultData(r)} /></div>);
}
