import { getTranslations } from "next-intl/server";
import { count, eq, isNull, or, and } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { PageHeader, Section } from "@/ui/page";
import { Card, Stat } from "@/ui/card";

export default async function TutorHome() {
  const ctx = await requireTutorPage();
  const t = await getTranslations("dashboard");
  const n = await withUser(ctx.user.id, async (tx) => {
    const one = async (q: Promise<{ c: number }[]>) => (await q)[0]?.c ?? 0;
    return {
      students: await one(tx.select({ c: count() }).from(schema.students).where(eq(schema.students.workspaceId, ctx.workspaceId))),
      assessments: await one(tx.select({ c: count() }).from(schema.assessments).where(eq(schema.assessments.workspaceId, ctx.workspaceId))),
      attempts: await one(tx.select({ c: count() }).from(schema.attempts).where(and(eq(schema.attempts.workspaceId, ctx.workspaceId), eq(schema.attempts.status, "graded")))),
      bank: await one(tx.select({ c: count() }).from(schema.questions).where(or(isNull(schema.questions.workspaceId), eq(schema.questions.workspaceId, ctx.workspaceId)))),
    };
  });
  const steps = [t("step1"), t("step2"), t("step3")];
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead", { workspace: ctx.workspaceName })} />
      <Section i={1}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t("students")} value={n.students} /><Stat label={t("assessments")} value={n.assessments} />
          <Stat label={t("attempts")} value={n.attempts} /><Stat label={t("bank")} value={n.bank.toLocaleString("ru-RU")} />
        </div>
      </Section>
      <Section title={t("firstTitle")} i={2}>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <Card key={s} className="p-6"><div className="grid place-items-center size-9 rounded-full bg-accent-soft text-accent-text font-semibold tnum">{i + 1}</div><p className="mt-4 t-h3 text-balance">{s}</p></Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
