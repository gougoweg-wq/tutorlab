import { pgTable, pgEnum, text, timestamp, uuid, integer, jsonb, boolean, primaryKey, index } from "drizzle-orm/pg-core";
import { workspaces, students } from "./core";
import { user } from "./auth";

export const lessonStatusEnum = pgEnum("lesson_status", ["planned", "done", "cancelled"]);
export const notificationKindEnum = pgEnum("notification_kind", ["assigned", "due_soon", "graded", "weekly_report", "lesson_reminder"]);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  status: lessonStatusEnum("status").notNull().default("planned"),
  topicIds: uuid("topic_ids").array().notNull().default([]),
  noteMd: text("note_md").notNull().default(""),
  callUrl: text("call_url"),
  materials: jsonb("materials").$type<{ name: string; url: string }[]>().notNull().default([]),
  homeworkAssessmentId: uuid("homework_assessment_id"),
  remindedAt: jsonb("reminded_at").$type<{ h24?: string; h1?: string }>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("lessons_ws_time_idx").on(t.workspaceId, t.startsAt)]);

export const lessonStudents = pgTable("lesson_students", {
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.lessonId, t.studentId] })]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  enabled: boolean("enabled").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.userId, t.kind] })]);

/** every outgoing email; without RESEND_API_KEY rows stay here with status "logged" */
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});
