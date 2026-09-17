import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: { default: "TutorLab", template: "%s · TutorLab" },
  description: "Платформа репетитора: задания, автопроверка и карта усвоения для учеников 6–11 классов и SAT.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f5f7" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("nav");
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html lang={locale} data-theme={theme === "light" || theme === "dark" ? theme : undefined} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:bg-surface focus:px-4 focus:py-2 focus:rounded-full focus:shadow-md">{t("skip")}</a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster position="top-center" toastOptions={{ style: { background: "var(--bg-elevated)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: "16px", boxShadow: "var(--shadow-md)", fontSize: "15px" } }} />
      </body>
    </html>
  );
}
