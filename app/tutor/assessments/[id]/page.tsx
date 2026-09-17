import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { listResultsForTutor } from "@/modules/assessments/service";
import { PageHeader } from "@/ui/page";
import { Badge } from "@/ui/badge";
import { TableWrap, Table, Th, Td, Tr } from "@/ui/table";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTutorPage();
  const t = await getTranslations("assessments");
  const [a] = await withUser(ctx.user.id, (tx) => tx.select().from(schema.assessments).where(and(eq(schema.assessments.id, id), eq(schema.assessments.workspaceId, ctx.workspaceId))));
  if (!a) notFound();
  const res = await listResultsForTutor(ctx, id);
  return (
    <div>
      <PageHeader eyebrow={t("results")} title={a.title} />
      <TableWrap className="rise"><Table><thead><tr><Th>{t("student")}</Th><Th>{t("result")}</Th><Th /></tr></thead>
        <tbody>{res.map((r) => (
          <Tr key={r.assignmentId}><Td className="font-medium">{r.student}</Td>
            <Td>{r.attemptId ? <Badge tone={(r.percent ?? 0) >= 80 ? "ok" : (r.percent ?? 0) >= 60 ? "warn" : "bad"}>{Math.round(r.percent ?? 0)}%</Badge> : <span className="text-muted">{t("notSubmitted")}</span>}</Td>
            <Td className="text-right">{r.attemptId && <Link className="text-accent-text hover:underline" href={`/tutor/assessments/attempts/${r.attemptId}`}>{t("open")}</Link>}</Td></Tr>))}</tbody></Table></TableWrap>
    </div>
  );
}
