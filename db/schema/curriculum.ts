import { pgTable, text, timestamp, uuid, integer, smallint, jsonb, boolean, numeric, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./core";

export type I18nName = { ru: string; en?: string; uz?: string };

/** workspace_id = null → global catalog shipped with seeds (read-only for everyone). */
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: jsonb("name").$type<I18nName>().notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("subjects_code_ws_idx").on(t.code, t.workspaceId)]);

/** Tree of topics. `code` is hierarchical (MATH.9.ALGEBRA.QUADRATIC_EQUATIONS); subtree = code LIKE 'prefix.%'. */
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  name: jsonb("name").$type<I18nName>().notNull(),
  grade: smallint("grade"),
  depth: smallint("depth").notNull().default(0),
  sort: integer("sort").notNull().default(0),
  isSat: boolean("is_sat").notNull().default(false),
  /** id of a procedural generator able to produce questions for this topic (modules/generators) */
  generatorId: text("generator_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("topics_code_ws_idx").on(t.code, t.workspaceId),
  index("topics_subject_idx").on(t.subjectId),
  index("topics_parent_idx").on(t.parentId),
]);

export const topicPrereqs = pgTable("topic_prereqs", {
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  requiresTopicId: uuid("requires_topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  weight: numeric("weight", { precision: 3, scale: 2, mode: "number" }).notNull().default(1),
}, (t) => [primaryKey({ columns: [t.topicId, t.requiresTopicId] })]);
