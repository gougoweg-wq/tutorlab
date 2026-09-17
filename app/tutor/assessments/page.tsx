import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { listForTutor, topicsForPicker } from "@/modules/assessments/service";
import { PageHeader } from "@/ui/page";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { EmptyState } from "@/ui/states";
import { TableWrap, Table, Th, Td, Tr } from "@/ui/table";
import { NewTest } from "@/modules/assessments/ui/new-test";

export default async function AssessmentsPage() {
  const ctx = await requireTutorPage();
  const t = await getTranslations("assessments");
  const [list, topics, students] = await Promise.all([listForTutor(ctx), topicsForPicker(ctx.workspaceId, await getLocale()),
    withUser(ctx.user.id, (tx) => tx.select({ id: schema.students.id, name: schema.students.displayName, grade: schema.students.grade }).from(schema.students).where(eq(schema.students.workspaceId, ctx.workspaceId)).orderBy(asc(schema.students.displayName)))]);
  const create = <NewTest topics={topics} students={students} />;
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead")} actions={create} />
      {!list.length ? <Card className="rise"><EmptyState icon={<ClipboardList />} title={t("emptyTitle")} text={t("emptyText")} action={create} /></Card> : (
        <TableWrap className="rise"><Table><thead><tr><Th>{t("name")}</Th><Th>{t("questions")}</Th><Th>{t("assigned")}</Th><Th>{t("submitted")}</Th><Th>{t("avg")}</Th></tr></thead>
          <tbody>{list.map((a) => (
            <Tr key={a.id}><Td><Link href={`/tutor/assessments/${a.id}`} className="font-medium text-accent-text hover:underline">{a.title}</Link>{a.isPractice && <Badge className="ml-2">{t("practice")}</Badge>}</Td>
              <Td className="tnum">{a.questions}</Td><Td className="tnum">{a.assigned}</Td><Td className="tnum">{a.submitted}</Td><Td className="tnum">{a.avg ?? "—"}</Td></Tr>))}</tbody></Table></TableWrap>
      )}
    </div>
  );
}
