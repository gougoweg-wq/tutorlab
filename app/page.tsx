import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarCheck, Compass, Dumbbell, Gauge, Languages, Smartphone } from "lucide-react";
import { getContext, getSessionUser, homeFor } from "@/modules/auth/context";
import { Button } from "@/ui/button";
import { Reveal, RevealGroup, RevealItem, CountUp } from "@/ui/reveal";
import { StickyNav } from "./_landing/sticky-nav";
import { HeroDevice } from "./_landing/hero-device";

export default async function Landing() {
  if (await getSessionUser()) { const ctx = await getContext(); redirect(ctx ? homeFor(ctx.role) : "/onboarding"); }
  const t = await getTranslations("landing");
  const stats = [{ v: 5000, s: "+", l: t("stat1") }, { v: 300, s: "+", l: t("stat2") }, { v: 8, s: "", l: t("stat3") }, { v: 10, s: "", l: t("stat4") }];
  const features = [
    { e: t("s1Eyebrow"), h: t("s1Title"), p: t("s1Text") },
    { e: t("s2Eyebrow"), h: t("s2Title"), p: t("s2Text") },
    { e: t("s3Eyebrow"), h: t("s3Title"), p: t("s3Text") },
  ];
  const bento = [
    { icon: <Compass />, h: t("bento1Title"), p: t("bento1Text"), wide: true },
    { icon: <Dumbbell />, h: t("bento2Title"), p: t("bento2Text") },
    { icon: <Smartphone />, h: t("bento3Title"), p: t("bento3Text") },
    { icon: <CalendarCheck />, h: t("bento4Title"), p: t("bento4Text") },
    { icon: <Gauge />, h: t("bento5Title"), p: t("bento5Text") },
    { icon: <Languages />, h: t("bento6Title"), p: t("bento6Text"), wide: true },
  ];
  return (
    <div className="overflow-x-clip">
      <StickyNav login={t("navLogin")} start={t("navStart")} />
      <main id="main">
        {/* hero */}
        <section className="relative pt-32 sm:pt-44 pb-10 px-5 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[640px] opacity-70 [background:radial-gradient(60%_60%_at_50%_0%,var(--accent-soft),transparent_70%)]" />
          <div className="relative max-w-[980px] mx-auto">
            <p className="t-eyebrow rise">{t("eyebrow")}</p>
            <h1 className="t-hero mt-5">
              <span className="block rise" style={{ "--i": 1 } as React.CSSProperties}>{t("heroA")}</span>
              <span className="block rise text-transparent bg-clip-text [background-image:linear-gradient(90deg,#0071e3,#7b5cff_45%,#ff375f)]" style={{ "--i": 3 } as React.CSSProperties}>{t("heroB")}</span>
            </h1>
            <p className="t-lead mt-7 max-w-[680px] mx-auto rise" style={{ "--i": 5 } as React.CSSProperties}>{t("heroLead")}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 rise" style={{ "--i": 7 } as React.CSSProperties}>
              <Button asChild size="lg"><Link href="/register">{t("ctaPrimary")}</Link></Button>
              <Button asChild size="lg" variant="ghost"><a href="#how">{t("ctaSecondary")} <span aria-hidden>›</span></a></Button>
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:pb-36">
          <HeroDevice labels={{ topic: t("mockTopic"), question: t("mockQuestion"), answer: t("mockAnswer"), check: t("mockCheck"), correct: t("mockCorrect"), mastery: t("mockMastery"), next: t("mockNext"), nextTopic: t("mockNextTopic"), weak: t("mockWeak"), strong: t("mockStrong"), equation: "x² − 5x + 6 = 0", topics: [t("mockT1"), t("mockT2"), t("mockT3"), t("mockT4"), t("mockT5"), t("mockT6"), t("mockT7"), t("mockT8")] }} />
        </section>

        {/* numbers */}
        <section className="px-5 pb-24 sm:pb-36">
          <RevealGroup className="max-w-[980px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-y-10 text-center">
            {stats.map((s) => (
              <RevealItem key={s.l}><div className="text-[44px] sm:text-[56px] font-bold tracking-[-0.045em] leading-none tnum"><CountUp value={s.v} suffix={s.s} /></div><div className="mt-2 t-small text-muted">{s.l}</div></RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* three big statements */}
        <section id="how" className="px-5 scroll-mt-20">
          <div className="max-w-[980px] mx-auto space-y-28 sm:space-y-44">
            {features.map((f, i) => (
              <Reveal key={f.h} className={i % 2 ? "md:ml-auto md:text-right max-w-[760px]" : "max-w-[760px]"}>
                <p className="t-eyebrow text-accent-text">{f.e}</p>
                <h2 className="t-display mt-3">{f.h}</h2>
                <p className="t-lead mt-5">{f.p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* bento */}
        <section className="px-5 pt-28 sm:pt-44">
          <RevealGroup className="max-w-[1080px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {bento.map((b) => (
              <RevealItem key={b.h} className={b.wide ? "lg:col-span-2" : ""}>
                <div className="group h-full min-h-[210px] rounded-[28px] bg-surface border border-line p-7 flex flex-col transition-[transform,box-shadow] duration-500 ease-apple hover:-translate-y-1 hover:shadow-md">
                  <div className="grid place-items-center size-11 rounded-[14px] bg-surface-2 text-ink-2 [&_svg]:size-5 transition-[background-color,color,transform] duration-500 ease-apple group-hover:bg-accent group-hover:text-accent-ink group-hover:scale-105">{b.icon}</div>
                  <h3 className="t-h2 mt-auto pt-8">{b.h}</h3>
                  <p className="mt-1.5 text-muted text-[16px]">{b.p}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* final CTA */}
        <section className="px-5 py-32 sm:py-48 text-center">
          <Reveal className="max-w-[820px] mx-auto">
            <h2 className="t-display">{t("finalTitle")}</h2>
            <p className="t-lead mt-4">{t("finalLead")}</p>
            <Button asChild size="lg" className="mt-9"><Link href="/register">{t("ctaPrimary")}</Link></Button>
          </Reveal>
        </section>
      </main>
      <footer className="border-t border-line px-5 py-8 text-center t-caption">{t("footer")}</footer>
    </div>
  );
}
