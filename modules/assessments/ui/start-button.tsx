"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { startAttemptAction } from "@/modules/assessments/actions";
import { Button } from "@/ui/button";

export function StartButton({ assignmentId, label, variant = "primary" }: { assignmentId: string; label: string; variant?: "primary" | "secondary" }) {
  const te = useTranslations("errors"); const router = useRouter(); const [pending, start] = React.useTransition();
  return <Button variant={variant} loading={pending} onClick={() => start(async () => { const r = await startAttemptAction(assignmentId); if (!r.ok) toast.error(te(r.error.code)); else router.push(`/student/attempt/${r.data}`); })}>{label}</Button>;
}
