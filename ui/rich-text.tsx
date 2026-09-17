import katex from "katex";
import { cn } from "./cn";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tex(src: string, display: boolean): string {
  try { return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: "ignore", output: "html" }); }
  catch { return `<code>${esc(src)}</code>`; }
}

function inline(s: string): string {
  // split out math first so markdown markers inside formulas are left alone
  const parts = s.split(/(\$[^$\n]+\$)/g);
  return parts.map((p) => {
    if (p.length > 2 && p.startsWith("$") && p.endsWith("$")) return tex(p.slice(1, -1), false);
    return esc(p)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  }).join("");
}

/**
 * Tiny, safe Markdown + LaTeX renderer for question stems and explanations.
 * Supports paragraphs, line breaks, - / 1. lists, **bold**, *italic*, `code`, $inline$ and $$display$$ math.
 * All input is HTML-escaped; only KaTeX output and the tags above are emitted.
 */
export function renderRich(md: string): string {
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/);
  return blocks.map((b) => {
    const t = b.trim();
    if (!t) return "";
    if (t.startsWith("$$") && t.endsWith("$$") && t.length > 4) return tex(t.slice(2, -2).trim(), true);
    const lines = t.split("\n");
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
    return `<p>${lines.map((l) => l.replace(/\$\$(.+?)\$\$/g, (_, m) => `$${m}$`)).map(inline).join("<br/>")}</p>`;
  }).join("");
}

export function RichText({ children, className }: { children: string; className?: string }) {
  return <div className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: renderRich(children) }} />;
}
