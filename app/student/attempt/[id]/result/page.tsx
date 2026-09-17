import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStudentPage } from "@/modules/auth/context";
import { getResult } from "@/modules/assessments/service";
import { AppError } from "@/modules/shared/result";
import { toResultData } from "@/modules/assessments/ui/to-result-data";
import { ResultView } from "@/modules/assessments/ui/result-view";
import { Button } from "@/ui/button";

export default async function StudentResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStudentPage();
  const t = await getTranslations("attempt");
  const r = await getResult(ctx, id, await getLocale()).catch((e) => (e instanceof AppError && e.code === "conflict" ? "open" as const : null));
  if (r === "open") redirect(`/student/attempt/${id}`);
  if (!r) notFound();
  return <ResultView data={toResultData(r)} footer={<Button asChild variant="secondary" size="lg" className="w-full sm:w-auto"><Link href="/student">{t("back")}</Link></Button>} />;
}
