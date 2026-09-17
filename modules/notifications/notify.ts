import "server-only";

export type NotifyEvent =
  | { kind: "assigned"; assignmentId: string }
  | { kind: "graded"; attemptId: string }
  | { kind: "due_soon"; assignmentId: string }
  | { kind: "lesson_reminder"; lessonId: string; when: "h24" | "h1" }
  | { kind: "weekly_report"; studentId: string };

/**
 * Single entry point for user-facing notifications: writes an in-app notification and queues an email,
 * honouring notification_prefs. Never throws — a failed notification must not break the calling flow.
 */
export async function notify(event: NotifyEvent): Promise<void> {
  try { const { deliver } = await import("./service"); await deliver(event); }
  catch (e) { const { log } = await import("@/modules/shared/log"); log.error("notify_failed", { kind: event.kind, error: String(e) }); }
}
