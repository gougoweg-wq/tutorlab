import { pgTable, pgEnum, text, timestamp, uuid, integer, smallint, jsonb, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roleEnum = pgEnum("role", ["owner", "tutor", "student", "parent"]);
export const trackEnum = pgEnum("track", ["school", "exam", "sat", "mixed"]);

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  aiBudgetCents: integer("ai_budget_cents").notNull().default(500),
  aiSpentCents: integer("ai_spent_cents").notNull().default(0),
  settings: jsonb("settings").$type<{ timezone?: string; contentLanguage?: string }>().notNull().default({}),
  ...ts,
});

export const memberships = pgTable("memberships", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdAt: ts.createdAt,
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("memberships_user_idx").on(t.userId)]);

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  grade: smallint("grade").notNull(),
  track: trackEnum("track").notNull().default("school"),
  subjects: text("subjects").array().notNull().default([]),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  /** public read-only report token for parents (null = disabled) */
  reportToken: text("report_token").unique(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...ts,
}, (t) => [index("students_ws_idx").on(t.workspaceId), index("students_user_idx").on(t.userId)]);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  role: roleEnum("role").notNull().default("student"),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedBy: text("used_by").references(() => user.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: ts.createdAt,
});

export const parentLinks = pgTable("parent_links", {
  parentUserId: text("parent_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: ts.createdAt,
}, (t) => [primaryKey({ columns: [t.parentUserId, t.studentId] })]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ...ts,
});

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.groupId, t.studentId] })]);

