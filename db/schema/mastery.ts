import { pgTable, timestamp, uuid, integer, smallint, boolean, numeric, primaryKey, index } from "drizzle-orm/pg-core";
import { students } from "./core";
import { topics } from "./curriculum";

export const mastery = pgTable("mastery", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  theta: numeric("theta", { precision: 7, scale: 4, mode: "number" }).notNull().default(0),
  nAttempts: integer("n_attempts").notNull().default(0),
  nCorrect: numeric("n_correct", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  /** cached at write time; readers must re-apply time decay via modules/mastery */
  mastery: smallint("mastery").notNull().default(50),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.topicId] })]);

export const masteryEvents = pgTable("mastery_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  attemptItemId: uuid("attempt_item_id"),
  thetaBefore: numeric("theta_before", { precision: 7, scale: 4, mode: "number" }).notNull(),
  thetaAfter: numeric("theta_after", { precision: 7, scale: 4, mode: "number" }).notNull(),
  difficulty: numeric("difficulty", { precision: 6, scale: 3, mode: "number" }).notNull(),
  outcome: numeric("outcome", { precision: 4, scale: 3, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("mastery_events_student_idx").on(t.studentId, t.createdAt)]);

export const reviewSchedule = pgTable("review_schedule", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  intervalDays: integer("interval_days").notNull().default(1),
  ease: numeric("ease", { precision: 4, scale: 2, mode: "number" }).notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.studentId, t.topicId] })]);

/** daily activity for streaks */
export const activityDays = pgTable("activity_days", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  day: timestamp("day", { withTimezone: false, mode: "string" }).notNull(),
  itemsAnswered: integer("items_answered").notNull().default(0),
  practiced: boolean("practiced").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.studentId, t.day] })]);
