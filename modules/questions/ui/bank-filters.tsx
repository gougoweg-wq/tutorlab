"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input, Select } from "@/ui/form";

export function BankFilters({ topics }: { topics: { id: string; grade: number | null; name: string }[] }) {
  const t = useTranslations("questions"); const c = useTranslations("common");
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); n.delete("page"); router.replace(`${path}?${n}`, { scroll: false }); };
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); ref.current?.focus(); } }; window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, []);
  const grades = [...new Set(topics.map((x) => x.grade))];
  return (
    <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1.4fr_1fr_0.8fr_0.9fr] rise">
      <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" aria-hidden /><Input ref={ref} aria-label={c("search")} placeholder={t("searchPh")} defaultValue={sp.get("q") ?? ""} className="pl-10" onChange={(e) => { clearTimeout(timer.current); const v = e.target.value; timer.current = setTimeout(() => set("q", v), 350); }} /></div>
      <Select aria-label={t("topic")} value={sp.get("topic") ?? ""} onChange={(e) => set("topic", e.target.value)}><option value="">{t("allTopics")}</option>{grades.map((g) => <optgroup key={String(g)} label={c("grade", { grade: g ?? 0 })}>{topics.filter((x) => x.grade === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</Select>
      <Select aria-label={t("type")} value={sp.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}><option value="">{t("allTypes")}</option><option value="single_choice">{t("type_single_choice")}</option><option value="numeric">{t("type_numeric")}</option></Select>
      <Select aria-label={c("difficulty")} value={sp.get("d") ?? ""} onChange={(e) => set("d", e.target.value)}><option value="">{c("difficulty")}</option>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}</Select>
      <Select aria-label={t("scope")} value={sp.get("scope") ?? "all"} onChange={(e) => set("scope", e.target.value === "all" ? "" : e.target.value)}><option value="all">{t("scopeAll")}</option><option value="own">{t("scopeOwn")}</option><option value="global">{t("scopeGlobal")}</option></Select>
    </div>
  );
}
