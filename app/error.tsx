"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors"); const c = useTranslations("common");
  return (
    <div className="min-h-[60dvh] grid place-items-center px-5 text-center">
      <div className="rise"><h1 className="t-title">{t("pageTitle")}</h1><p className="mt-2 text-muted">{t("pageText")}</p><Button className="mt-6" onClick={reset}>{c("retry")}</Button></div>
    </div>
  );
}
