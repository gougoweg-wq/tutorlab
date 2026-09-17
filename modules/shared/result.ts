/** Uniform result of every Server Action. Error messages are i18n keys under `errors.*`. */
export type ErrorCode =
  | "unauthorized" | "forbidden" | "not_found" | "validation" | "conflict"
  | "rate_limited" | "deadline_passed" | "already_submitted" | "attempts_exhausted"
  | "budget_exceeded" | "bank_too_small" | "internal";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message?: string; fields?: Record<string, string> } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message?: string, fields?: Record<string, string>): ActionResult<never> => ({ ok: false, error: { code, message, fields } });

export class AppError extends Error {
  constructor(public code: ErrorCode, message?: string, public fields?: Record<string, string>) { super(message ?? code); }
}

/** Wrap a server action body: AppError → typed failure, anything else → logged "internal". */
export async function action<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try { return ok(await fn()); }
  catch (e) {
    if (e instanceof AppError) return fail(e.code, e.message, e.fields);
    // Next.js control-flow errors (redirect/notFound) must bubble
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest?: unknown }).digest === "string" && String((e as { digest: string }).digest).startsWith("NEXT_")) throw e;
    const { log } = await import("./log");
    log.error("action_failed", { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined });
    return fail("internal");
  }
}
