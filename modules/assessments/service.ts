import "server-only";
import type { PracticeInput } from "./practice";
import { AppError } from "@/modules/shared/result";
/** Implemented by the assessments module. */
export async function createBlueprintAssignment(input: PracticeInput): Promise<{ assessmentId: string; assignmentId: string }> { void input; throw new AppError("internal", "assessments service is not wired"); }
