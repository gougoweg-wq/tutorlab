import Link from "next/link";
import { cn } from "@/ui/cn";

type L = { id: string; startsAt: string; durationMin: number; status: string; title: string; sub: string };
const H0 = 8, H1 = 22, ROW = 44; const TZ = "Asia/Tashkent";

/** Parts of a date in the workspace timezone — the grid must not depend on the server's own timezone. */
function parts(d: Date) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d).map((x) => [x.type, x.value])); return { key: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) }; }
export function weekDays(offset: number, now = new Date()): Date[] {
  const today = parts(now).key; const base = new Date(`${today}T12:00:00Z`); const dow = (base.getUTCDay() + 6) % 7; base.setUTCDate(base.getUTCDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setUTCDate(base.getUTCDate() + i); return d; });
}

export function WeekGrid({ lessons, offset, locale, labels }: { lessons: L[]; offset: number; locale: string; labels: { prev: string; next: string; today: string } }) {
  const days = weekDays(offset); const keys = days.map((d) => d.toISOString().slice(0, 10)); const todayKey = parts(new Date()).key;
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" }); const fmtRange = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  const nav = "h-8 px-3.5 grid place-items-center rounded-full bg-surface-3/70 text-[13px] font-medium hover:bg-surface-3 transition-colors";
  return (
    <div className="hidden md:block">
      <div className="flex items-center justify-between mb-3"><div className="t-h3">{fmtRange.format(days[0])} — {fmtRange.format(days[6])}</div>
        <div className="flex gap-1.5"><Link className={nav} href={`?w=${offset - 1}`} aria-label={labels.prev}>‹</Link><Link className={nav} href="?w=0">{labels.today}</Link><Link className={nav} href={`?w=${offset + 1}`} aria-label={labels.next}>›</Link></div></div>
      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">{[<div key="c" />, ...days.map((d, i) => <div key={i} className={cn("py-2.5 text-center text-[13px] font-medium capitalize", keys[i] === todayKey ? "text-accent-text" : "text-muted")}>{fmtDay.format(d)}</div>)]}</div>
        <div className="grid grid-cols-[52px_repeat(7,1fr)] relative" style={{ height: (H1 - H0) * ROW }}>
          <div>{Array.from({ length: H1 - H0 }, (_, h) => <div key={h} className="text-right pr-2 t-caption tnum" style={{ height: ROW, transform: "translateY(-7px)" }}>{h ? `${H0 + h}:00` : ""}</div>)}</div>
          {keys.map((k, col) => (
            <div key={k} className={cn("relative border-l border-line", k === todayKey && "bg-accent-soft/40")}>
              {Array.from({ length: H1 - H0 - 1 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: (h + 1) * ROW }} />)}
              {lessons.filter((l) => parts(new Date(l.startsAt)).key === k).map((l) => { const p = parts(new Date(l.startsAt)); const top = Math.max(0, (p.hour + p.minute / 60 - H0) * ROW); const h = Math.max(26, (l.durationMin / 60) * ROW - 3);
                return (<a key={l.id} href={`#lesson-${l.id}`} title={`${l.title} · ${l.sub}`} className={cn("absolute inset-x-1 rounded-[10px] px-2 py-1 overflow-hidden text-[12px] leading-tight transition-transform duration-200 ease-apple hover:scale-[1.02] hover:z-10",
                  l.status === "cancelled" ? "bg-surface-3 text-muted line-through" : l.status === "done" ? "bg-ok-soft text-ok-text" : "bg-accent text-accent-ink shadow-sm")} style={{ top, height: Math.min(h, (H1 - H0) * ROW - top) }}>
                  <div className="font-semibold tnum">{String(p.hour).padStart(2, "0")}:{String(p.minute).padStart(2, "0")}</div><div className="truncate">{l.title}</div></a>); })}
            </div>))}
        </div>
      </div>
    </div>
  );
}
