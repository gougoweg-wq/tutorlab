import { pgTable, pgEnum, text, timestamp, uuid, integer, smallint, jsonb, boolean, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces, students, groups } from "./core";
import { user } from "./auth";
import { topics } from "./curriculum";
import { questionVersions } from "./questions";
import type { AssessmentSettings } from "@/modules/assessments/types";
import type { AnswerPayload, AiGrade, TutorOverride } from "@/modules/questions/types";

export const assessmentKindEnum = pgEnum("assessment_kind", ["fixed", "blueprint"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "ready", "archived"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted", "graded", "needs_review"]);

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: assessmentKindEnum("kind").notNull().default("fixed"),
  status: assessmentStatusEnum("status").notNull().default("draft"),
  /** practice sets are created by the recommender / student "train weak topics" */
  isPractice: boolean("is_practice").notNull().default(false),
  settings: jsonb("settings").$type<AssessmentSettings>().notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assessments_ws_idx").on(t.workspaceId)]);

export const assessmentItems = pgTable("assessment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionVersionId: uuid("question_version_id").notNull().references(() => questionVersions.id),
  sort: integer("sort").notNull().default(0),
  weight: numeric("weight", { precision: 5, scale: 2, mode: "number" }).notNull().default(1),
}, (t) => [index("ai_assessment_idx").on(t.assessmentId)]);

export const blueprintRules = pgTable("blueprint_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  includeSubtree: boolean("include_subtree").notNull().default(true),
  count: integer("count").notNull(),
  difficultyMin: smallint("difficulty_min").notNull().default(1),
  difficultyMax: smallint("difficulty_max").notNull().default(5),
  types: text("types").array(),
  sort: integer("sort").notNull().default(0),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  batchId: uuid("batch_id"),
  lessonId: uuid("lesson_id"),
  availableFrom: timestamp("available_from", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assignments_student_idx").on(t.studentId), index("assignments_ws_idx").on(t.workspaceId)]);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  attemptNo: integer("attempt_no").notNull().default(1),
  /** server clock only — never accept client timestamps */
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  status: attemptStatusEnum("status").notNull().default("in_progress"),
  score: numeric("score", { precision: 8, scale: 2, mode: "number" }),
  maxScore: numeric("max_score", { precision: 8, scale: 2, mode: "number" }),
  percent: numeric("percent", { precision: 5, scale: 2, mode: "number" }),
  variantSeed: text("variant_seed").notNull().default(""),
  clientMeta: jsonb("client_meta").$type<{ userAgent?: string }>(),
}, (t) => [
  uniqueIndex("attempts_unique_idx").on(t.assignmentId, t.studentId, t.attemptNo),
  index("attempts_student_idx").on(t.studentId),
]);

export const attemptItems = pgTable("attempt_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id, { onDelete: "cascade" }),
  questionVersionId: uuid("question_version_id").notNull().references(() => questionVersions.id),
  sort: integer("sort").notNull().default(0),
  weight: numeric("weight", { precision: 5, scale: 2, mode: "number" }).notNull().default(1),
  /** per-attempt option order when shuffling is on (option ids) */
  optionOrder: text("option_order").array(),
  answer: jsonb("answer").$type<AnswerPayload>(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  timeSpentSec: integer("time_spent_sec").notNull().default(0),
  score: numeric("score", { precision: 8, scale: 2, mode: "number" }),
  maxScore: numeric("max_score", { precision: 8, scale: 2, mode: "number" }).notNull().default(1),
  isCorrect: boolean("is_correct"),
  aiGrade: jsonb("ai_grade").$type<AiGrade>(),
  tutorOverride: jsonb("tutor_override").$type<TutorOverride>(),
}, (t) => [uniqueIndex("attempt_items_unique_idx").on(t.attemptId, t.questionVersionId), index("attempt_items_attempt_idx").on(t.attemptId)]);
