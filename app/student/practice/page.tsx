import { getLocale, getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { requireStudentPage } from "@/modules/auth/context";
import { getDb, schema } from "@/db/client";
import { practiceTopics } from "@/modules/assessments/service";
import { PracticeBuilder } from "@/modules/assessments/ui/practice-builder";

export default async function PracticePage() {
  const ctx = await requireStudentPage();
  const t = await getTranslations("practice");
  const db = await getDb();
  const [st] = await db.select({ grade: schema.students.grade, track: schema.students.track }).from(schema.students).where(eq(schema.students.id, ctx.studentId));
  const topics = await practiceTopics(ctx, await getLocale());
  const hasGrade = topics.some((x) => !x.isSat && x.grade === st?.grade);
  return (
    <div>
      <header className="mb-8 rise"><h1 className="t-display">{t("title")}</h1><p className="t-lead mt-2">{t("lead")}</p></header>
      <PracticeBuilder topics={topics} defaultGroup={st?.track === "sat" ? "sat" : hasGrade ? String(st?.grade) : "9"} />
    </div>
  );
}
