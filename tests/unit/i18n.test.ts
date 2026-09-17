import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NAMESPACES } from "@/i18n/config";

const load = (l: string, ns: string): Record<string, unknown> => { const f = path.join(process.cwd(), "messages", l, `${ns}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}; };
const vars = (s: unknown) => (typeof s === "string" ? [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join(",") : "");

describe("dictionaries", () => {
  it.each(NAMESPACES.flatMap((ns) => ["en", "uz"].map((l) => [ns, l] as const)))("%s/%s covers every Russian key with the same placeholders", (ns, l) => {
    const ru = load("ru", ns), tr = load(l, ns);
    for (const [k, v] of Object.entries(ru)) { expect(tr, `${l}/${ns}.${k} is missing`).toHaveProperty(k); expect(vars(tr[k]), `${l}/${ns}.${k} placeholders`).toBe(vars(v)); }
  });
});
