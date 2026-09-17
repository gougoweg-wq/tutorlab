"use client";
import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { authClient } from "@/modules/auth/client";
import { setLocaleAction, setThemeAction } from "@/modules/auth/actions";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { cn } from "@/ui/cn";

const item = "flex items-center gap-2.5 px-3 h-9 rounded-[10px] text-[14px] text-ink cursor-default select-none outline-none data-[highlighted]:bg-surface-2";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [theme, setTheme] = React.useState<string>("system");
  React.useEffect(() => { setTheme(document.documentElement.dataset.theme ?? "system"); }, []);

  const applyTheme = async (v: "light" | "dark" | "system") => {
    if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    setTheme(v); await setThemeAction(v);
  };
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <DM.Root>
      <DM.Trigger className="grid place-items-center size-9 rounded-full bg-ink text-bg text-[13px] font-semibold transition-transform duration-200 ease-apple active:scale-95" aria-label={name}>{initials}</DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-64 p-1.5 rounded-[16px] glass border shadow-lg data-[state=open]:animate-[pop_.3s_var(--ease)]">
          <div className="px-3 py-2.5">
            <div className="text-[14px] font-semibold truncate">{name}</div>
            <div className="text-[12px] text-muted truncate">{email}</div>
          </div>
          <DM.Separator className="h-px bg-line my-1" />
          <DM.Label className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-muted">{t("language")}</DM.Label>
          {LOCALES.map((l) => (
            <DM.Item key={l} className={item} onSelect={async () => { await setLocaleAction(l); router.refresh(); }}>
              <span className="flex-1">{LOCALE_NAMES[l]}</span>{locale === l && <Check className="size-4 text-accent-text" />}
            </DM.Item>
          ))}
          <DM.Separator className="h-px bg-line my-1" />
          <DM.Label className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-muted">{t("theme")}</DM.Label>
          {([["light", Sun, t("themeLight")], ["dark", Moon, t("themeDark")], ["system", Monitor, t("themeSystem")]] as const).map(([v, Icon, label]) => (
            <DM.Item key={v} className={item} onSelect={() => applyTheme(v)}>
              <Icon className="size-4 text-muted" /><span className="flex-1">{label}</span>{theme === v && <Check className="size-4 text-accent-text" />}
            </DM.Item>
          ))}
          <DM.Separator className="h-px bg-line my-1" />
          <DM.Item className={cn(item, "text-bad-text")} onSelect={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>
            <LogOut className="size-4" />{t("signOut")}
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
