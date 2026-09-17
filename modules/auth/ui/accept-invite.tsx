"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { acceptInviteAction } from "@/modules/auth/actions";
import { Button } from "@/ui/button";

export function AcceptInvite({ code }: { code: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [pending, start] = React.useTransition();
  return (
    <Button size="lg" className="w-full" loading={pending}
      onClick={() => start(async () => { const res = await acceptInviteAction(code); if (res && !res.ok) toast.error(te(res.error.code)); })}>
      {t("inviteAccept")}
    </Button>
  );
}
