import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { PageHeader } from "@/ui/page";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { EmptyState } from "@/ui/states";
import { TableWrap, Table, Th, Td, Tr } from "@/ui/table";
import { AddStudent, InviteButton } from "@/modules/students/ui/add-student";

export default async function StudentsPage() {
  const ctx = await requireTutorPage();
  const t = await getTranslations("students"); const c = await getTranslations("common");
  const list = await withUser(ctx.user.id, (tx) => tx.select().from(schema.students).where(eq(schema.students.workspaceId, ctx.workspaceId)).orderBy(asc(schema.students.displayName)));
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead")} actions={<AddStudent />} />
      {!list.length ? <Card className="rise"><EmptyState icon={<Users />} title={t("emptyTitle")} text={t("emptyText")} action={<AddStudent />} /></Card> : (
        <TableWrap className="rise"><Table><thead><tr><Th>{t("name")}</Th><Th>{t("grade")}</Th><Th>{t("status")}</Th><Th /></tr></thead>
          <tbody>{list.map((s) => (
            <Tr key={s.id}><Td className="font-medium">{s.displayName}</Td><Td>{c("grade", { grade: s.grade })}</Td>
              <Td>{s.userId ? <Badge tone="ok">{t("active")}</Badge> : <Badge tone="warn">{t("invited")}</Badge>}</Td>
              <Td className="text-right">{!s.userId && <InviteButton studentId={s.id} />}</Td></Tr>))}</tbody></Table></TableWrap>
      )}
    </div>
  );
}
