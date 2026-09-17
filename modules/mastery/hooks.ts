import "server-only";

/**
 * Called by modules/assessments right after an attempt has been scored (status graded or needs_review).
 * Updates mastery, mastery_events, review_schedule, activity_days and question difficulty calibration.
 * Must be idempotent per attempt item (re-running for the same attempt must not double-count).
 */
export async function onAttemptGraded(attemptId: string): Promise<void> {
  const { recordAttempt } = await import("./service");
  await recordAttempt(attemptId);
}
