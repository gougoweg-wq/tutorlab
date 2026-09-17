"use client";
import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Check, Sparkles } from "lucide-react";

const EASE = [0.28, 0.11, 0.32, 1] as const;
type Labels = Record<"topic" | "question" | "answer" | "check" | "correct" | "mastery" | "next" | "nextTopic" | "weak" | "strong", string> & { topics: string[]; equation: string };

/** The product, drawn in its own components. Scales and settles as the page scrolls, the way Apple stages hardware. */
export function HeroDevice({ labels }: { labels: Labels }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.45, 1], [0.86, 1, 1.04]);
  const rotateX = useTransform(scrollYProgress, [0, 0.45], [14, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const values = [92, 84, 78, 66, 41, 33, 58, 71];

  const [typed, setTyped] = React.useState("");
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (reduce) { setTyped("2; 3"); setDone(true); return; }
    const full = "2; 3"; let i = 0; let t2: ReturnType<typeof setTimeout>;
    const t1 = setInterval(() => { i += 1; setTyped(full.slice(0, i)); if (i >= full.length) { clearInterval(t1); t2 = setTimeout(() => setDone(true), 500); } }, 260);
    return () => { clearInterval(t1); clearTimeout(t2); };
  }, [reduce]);

  return (
    <div ref={ref} className="[perspective:1600px]">
      <motion.div style={reduce ? undefined : { scale, rotateX, y }} className="mx-auto max-w-[1040px] rounded-[28px] sm:rounded-[36px] border border-line bg-surface shadow-lg overflow-hidden origin-top">
        <div className="h-10 flex items-center gap-1.5 px-4 border-b border-line bg-surface-2/70">
          <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="grid md:grid-cols-[1.1fr_1fr] gap-px bg-line">
          {/* question */}
          <div className="bg-surface p-6 sm:p-9">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted"><span className="inline-grid place-items-center size-6 rounded-full bg-accent-soft text-accent-text text-[11px] font-semibold">7</span>{labels.topic}</div>
            <div className="mt-5 text-[15px] text-muted">{labels.question}</div>
            <div className="mt-1 text-[26px] sm:text-[34px] font-semibold tracking-[-0.03em] font-[ui-serif,Georgia,serif] italic">{labels.equation}</div>
            <div className="mt-7 text-[12px] font-medium text-muted">{labels.answer}</div>
            <div className={`mt-1.5 h-12 rounded-[14px] border px-4 flex items-center justify-between text-[18px] font-mono transition-colors duration-500 ${done ? "border-ok bg-ok-soft" : "border-line-strong"}`}>
              <span>{typed}<span className={`inline-block w-[2px] h-5 align-[-3px] ml-0.5 bg-accent ${done ? "opacity-0" : "animate-pulse"}`} /></span>
              {done && <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="inline-flex items-center gap-1 text-[13px] font-sans font-semibold text-ok-text"><Check className="size-4" />{labels.correct}</motion.span>}
            </div>
            <div className="mt-4 inline-flex h-10 px-5 items-center rounded-full bg-accent text-accent-ink text-[15px] font-medium">{labels.check}</div>
          </div>
          {/* mastery */}
          <div className="bg-surface p-6 sm:p-9">
            <div className="text-[12px] font-medium text-muted">{labels.mastery}</div>
            <div className="mt-4 space-y-2.5">
              {labels.topics.map((name, i) => {
                const v = values[i]; const tone = v < 50 ? "bg-bad" : v < 75 ? "bg-warn" : "bg-ok";
                return (
                  <div key={name} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
                    <div className="text-[13px] truncate">{name}</div>
                    <div className="text-[12px] tabular-nums text-muted w-7 text-right">{v}</div>
                    <div className="col-span-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: reduce ? `${v}%` : 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.25 + i * 0.07, ease: EASE }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
              className="mt-6 rounded-[16px] bg-accent-soft p-4 flex items-center gap-3">
              <span className="grid place-items-center size-9 rounded-full bg-accent text-accent-ink"><Sparkles className="size-4" /></span>
              <div><div className="text-[12px] text-accent-text font-medium">{labels.next}</div><div className="text-[15px] font-semibold">{labels.nextTopic}</div></div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
