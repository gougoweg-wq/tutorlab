import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { PageHeader } from "@/ui/page";
import { MasteryView } from "@/modules/mastery/ui/mastery-view";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTutorPage();
  const c = await getTranslations("common"); const t = await getTranslations("progress");
  const [st] = await withUser(ctx.user.id, (tx) => tx.select().from(schema.students).where(and(eq(schema.students.id, id), eq(schema.students.workspaceId, ctx.workspaceId))));
  if (!st) notFound();
  return (<div><PageHeader eyebrow={`${c("grade", { grade: st.grade })} · ${t("title")}`} title={st.displayName} /><MasteryView studentId={st.id} forStudent={false} /></div>);
}
