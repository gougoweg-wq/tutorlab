type Level = "debug" | "info" | "warn" | "error";
function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
}
/** Structured JSON logs — one line per event. */
export const log = {
  debug: (e: string, d?: Record<string, unknown>) => { if (process.env.NODE_ENV !== "production") emit("debug", e, d); },
  info: (e: string, d?: Record<string, unknown>) => emit("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => emit("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => emit("error", e, d),
};
