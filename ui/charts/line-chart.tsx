/** Dependency-free SVG line chart on design tokens. One idea per chart: a 0–100 percentage over time. */
export function LineChart({ points, label, yLabel }: { points: { x: string; y: number; hint?: string }[]; label: string; yLabel: string }) {
  const W = 640, H = 220, L = 38, R = 14, T = 14, B = 30;
  const n = points.length; const px = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)); const py = (v: number) => T + (1 - v / 100) * (H - T - B);
  const path = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const area = n > 1 ? `${path} L${px(n - 1).toFixed(1)},${py(0)} L${px(0).toFixed(1)},${py(0)} Z` : "";
  const every = Math.ceil(n / 6);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
        <title>{label}</title>
        {[0, 25, 50, 75, 100].map((v) => (<g key={v}><line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth="1" /><text x={L - 8} y={py(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</text></g>))}
        {area && <path d={area} fill="var(--accent)" opacity="0.1" />}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (<g key={p.x}><circle cx={px(i)} cy={py(p.y)} r={i === n - 1 ? 5 : 3} fill={i === n - 1 ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="2"><title>{`${p.x}: ${p.y}%${p.hint ? ` · ${p.hint}` : ""}`}</title></circle>
          {(i % every === 0 || i === n - 1) && <text x={px(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.x}</text>}</g>))}
        <text x={px(n - 1)} y={py(points[n - 1].y) - 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">{points[n - 1].y}%</text>
      </svg>
      <figcaption className="t-caption mt-1">{yLabel}</figcaption>
      <table className="sr-only"><caption>{label}</caption><tbody>{points.map((p) => <tr key={p.x}><th scope="row">{p.x}</th><td>{p.y}%</td></tr>)}</tbody></table>
    </figure>
  );
}
