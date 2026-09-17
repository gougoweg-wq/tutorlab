import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="min-h-dvh grid place-items-center px-5 text-center">
      <div className="rise"><div className="t-hero text-surface-3">404</div><h1 className="t-title mt-2">{t("notFoundTitle")}</h1><p className="mt-2 text-muted">{t("notFoundText")}</p><Button asChild className="mt-6"><Link href="/">{t("home")}</Link></Button></div>
    </div>
  );
}
