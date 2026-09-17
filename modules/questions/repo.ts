import "server-only";
import { inArray, isNull, or, eq, and } from "drizzle-orm";
import { schema, type Executor } from "@/db/client";
import { questionDraftSchema, type QuestionDraft } from "./types";
import { contentHash } from "./normalize";

export type InsertQuestionInput = {
  workspaceId: string | null;              // null = global bank (seeds only)
  draft: QuestionDraft;
  source: "manual" | "ai" | "imported" | "generator";
  status: "draft" | "review" | "published";
  authorId?: string | null;
  aiGenerationId?: string | null;
};

/** topic code → id, preferring the workspace's own topic over the global one */
export async function resolveTopicIds(exec: Executor, workspaceId: string | null, codes: string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const rows = await exec.select({ id: schema.topics.id, code: schema.topics.code, ws: schema.topics.workspaceId }).from(schema.topics)
    .where(and(inArray(schema.topics.code, codes), workspaceId ? or(isNull(schema.topics.workspaceId), eq(schema.topics.workspaceId, workspaceId)) : isNull(schema.topics.workspaceId)));
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.code) || r.ws) map.set(r.code, r.id);
  return map;
}

/** Single write path for new questions (editor, import, generator, AI, seeds). Validates the draft. */
export async function insertQuestion(exec: Executor, input: InsertQuestionInput): Promise<{ questionId: string; versionId: string }> {
  const draft = questionDraftSchema.parse(input.draft);
  const topicIds = await resolveTopicIds(exec, input.workspaceId, draft.topicCodes);
  const [q] = await exec.insert(schema.questions).values({
    workspaceId: input.workspaceId, type: draft.type, status: input.status, source: input.source,
    difficulty: draft.difficulty, eloDifficulty: (draft.difficulty - 3) * 0.8, grade: draft.grade ?? null,
    language: draft.language, tags: draft.tags, contentHash: contentHash(draft.stemMd),
    authorId: input.authorId ?? null, aiGenerationId: input.aiGenerationId ?? null,
  }).returning({ id: schema.questions.id });
  const [v] = await exec.insert(schema.questionVersions).values({
    questionId: q.id, version: 1, stemMd: draft.stemMd, options: draft.options ?? null, answer: draft.answer,
    explanationMd: draft.explanationMd, rubric: draft.rubric ?? null, createdBy: input.authorId ?? null,
  }).returning({ id: schema.questionVersions.id });
  await exec.update(schema.questions).set({ currentVersionId: v.id }).where(eq(schema.questions.id, q.id));
  const links = draft.topicCodes.map((c, i) => ({ code: c, id: topicIds.get(c), primary: i === 0 })).filter((l): l is { code: string; id: string; primary: boolean } => Boolean(l.id));
  if (links.length) await exec.insert(schema.questionTopics).values(links.map((l) => ({ questionId: q.id, topicId: l.id, isPrimary: l.primary }))).onConflictDoNothing();
  return { questionId: q.id, versionId: v.id };
}
