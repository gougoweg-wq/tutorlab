import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { UserRoundPlus } from "lucide-react";
import { getInvite } from "@/modules/auth/invites";
import { getSessionUser } from "@/modules/auth/context";
import { googleEnabled } from "@/modules/auth/auth";
import { AuthForm } from "@/modules/auth/ui/auth-form";
import { AcceptInvite } from "@/modules/auth/ui/accept-invite";
import { ErrorState } from "@/ui/states";

export const metadata = { title: "Приглашение" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("auth");
  const invite = await getInvite(code);
  if (!invite) return <ErrorState title={t("inviteExpired")} />;
  const user = await getSessionUser();
  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 grid place-items-center size-16 rounded-full bg-accent-soft text-accent-text pop"><UserRoundPlus className="size-7" /></div>
        <h1 className="t-title">{t("inviteTitle")}</h1>
        <p className="mt-2 text-muted">{t("inviteLead", { tutor: invite.tutorName, workspace: invite.workspaceName })}</p>
        {invite.studentName && <p className="mt-1 t-small text-muted">{t("inviteFor", { student: invite.studentName })}</p>}
      </div>
      {user ? (
        <div className="space-y-3">
          <p className="text-center t-small text-muted">{t("inviteSignedInAs", { email: user.email })}</p>
          <AcceptInvite code={invite.code} />
        </div>
      ) : (
        <Suspense><AuthForm mode="register" google={googleEnabled()} next={`/invite/${invite.code}`} /></Suspense>
      )}
    </div>
  );
}
