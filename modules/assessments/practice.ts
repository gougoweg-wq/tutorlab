import "server-only";
import type { BlueprintRule } from "./types";

export type PracticeInput = {
  workspaceId: string;
  studentId: string;
  title: string;
  rules: BlueprintRule[];
  createdBy: string | null;
  /** homework created from a lesson */
  lessonId?: string | null;
  dueAt?: Date | null;
  isPractice?: boolean;
};

/**
 * Creates a blueprint assessment + assignment for one student in a single transaction and returns the assignment id.
 * Used by: mastery recommendations ("train weak topics"), student practice mode, lesson homework.
 * Throws AppError("bank_too_small") when the bank cannot satisfy the rules.
 */
export async function createPracticeAssignment(input: PracticeInput): Promise<{ assessmentId: string; assignmentId: string }> {
  const { createBlueprintAssignment } = await import("./service");
  return createBlueprintAssignment(input);
}
