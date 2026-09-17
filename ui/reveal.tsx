"use client";
import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

const EASE = [0.28, 0.11, 0.32, 1] as const;

/** Scroll-triggered entrance. Content stays in the DOM and visible to no-JS / reduced-motion users. */
export function Reveal({ children, delay = 0, y = 28, className, ...rest }: { children: React.ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y, scale: 0.985 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-12% 0px" }} transition={{ duration: 0.8, delay, ease: EASE }} {...rest}>
      {children}
    </motion.div>
  );
}

/** Staggered children: wrap items in <RevealItem>. */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: React.ReactNode; className?: string; stagger?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10% 0px" }} variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}>
      {children}
    </motion.div>
  );
}
export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={{ hidden: { opacity: 0, y: 24, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } } }}>{children}</motion.div>;
}

/** Counts up to `value` when it scrolls into view. */
export function CountUp({ value, suffix = "", duration = 1.2, className }: { value: number; suffix?: string; duration?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(reduce ? value : 0);
  React.useEffect(() => {
    if (reduce) { setShown(value); return; }
    const el = ref.current; if (!el) return;
    let raf = 0; let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true; const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / (duration * 1000)); const eased = 1 - Math.pow(1 - p, 4); setShown(Math.round(value * eased)); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration, reduce]);
  return <span ref={ref} className={className}>{shown.toLocaleString("ru-RU")}{suffix}</span>;
}
