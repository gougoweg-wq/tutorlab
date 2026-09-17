import { getTranslations } from "next-intl/server";
import { requireStudentPage } from "@/modules/auth/context";
import { MasteryView } from "@/modules/mastery/ui/mastery-view";

export default async function ProgressPage() {
  const ctx = await requireStudentPage();
  const t = await getTranslations("progress");
  return (<div><header className="mb-8 rise"><h1 className="t-display">{t("title")}</h1><p className="t-lead mt-2">{t("lead")}</p></header><MasteryView studentId={ctx.studentId} forStudent /></div>);
}
