import { pgTable, pgEnum, text, timestamp, uuid, integer, smallint, jsonb, boolean, numeric, primaryKey, index } from "drizzle-orm/pg-core";
import { workspaces } from "./core";
import { user } from "./auth";
import { topics } from "./curriculum";
import type { QuestionOptions, QuestionAnswer, Rubric } from "@/modules/questions/types";

export const questionTypeEnum = pgEnum("question_type", ["single_choice", "multiple_choice", "numeric", "short_text", "matching", "ordering", "cloze", "free_text"]);
export const questionStatusEnum = pgEnum("question_status", ["draft", "review", "published", "archived"]);
export const questionSourceEnum = pgEnum("question_source", ["manual", "ai", "imported", "generator"]);

/** workspace_id = null → global bank shipped with seeds (read-only, visible to every workspace). */
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  type: questionTypeEnum("type").notNull(),
  status: questionStatusEnum("status").notNull().default("draft"),
  source: questionSourceEnum("source").notNull().default("manual"),
  difficulty: smallint("difficulty").notNull().default(3),
  /** calibrated by the mastery model; starts from (difficulty-3)*0.8 */
  eloDifficulty: numeric("elo_difficulty", { precision: 6, scale: 3, mode: "number" }).notNull().default(0),
  answersCount: integer("answers_count").notNull().default(0),
  grade: smallint("grade"),
  language: text("language").notNull().default("ru"),
  tags: text("tags").array().notNull().default([]),
  currentVersionId: uuid("current_version_id"),
  /** normalized stem used for dedupe (trigram similarity) and search */
  contentHash: text("content_hash").notNull().default(""),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  aiGenerationId: uuid("ai_generation_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("questions_ws_status_idx").on(t.workspaceId, t.status), index("questions_type_idx").on(t.type)]);

/** Immutable. Editing a published question creates a new version; attempts keep pointing at the version they answered. */
export const questionVersions = pgTable("question_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  stemMd: text("stem_md").notNull(),
  options: jsonb("options").$type<QuestionOptions>(),
  answer: jsonb("answer").$type<QuestionAnswer>().notNull(),
  explanationMd: text("explanation_md").notNull().default(""),
  rubric: jsonb("rubric").$type<Rubric>(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("qv_question_idx").on(t.questionId)]);

export const questionTopics = pgTable("question_topics", {
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.questionId, t.topicId] }), index("qt_topic_idx").on(t.topicId)]);

export const questionMedia = pgTable("question_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  alt: text("alt").notNull().default(""),
  width: integer("width"),
  height: integer("height"),
});
