import { pgTable, pgEnum, text, timestamp, uuid, integer, jsonb, numeric, index } from "drizzle-orm/pg-core";
import { workspaces } from "./core";
import { user } from "./auth";

export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed"]);

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  provider: text("provider").notNull().default("procedural"),
  promptName: text("prompt_name"),
  promptVersion: text("prompt_version"),
  model: text("model"),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  outputSummary: jsonb("output_summary").$type<{ requested?: number; produced?: number; passedSchema?: number; passedSolve?: number; deduped?: number; saved?: number }>().notNull().default({}),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costCents: numeric("cost_cents", { precision: 10, scale: 4, mode: "number" }).notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: jobStatusEnum("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("ai_gen_ws_idx").on(t.workspaceId, t.createdAt)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  diff: jsonb("diff").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_ws_idx").on(t.workspaceId, t.createdAt)]);

/** Minimal DB-backed queue. Runner: modules/jobs/runner.ts, kicked by after() and /api/jobs/run (cron). */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: jobStatusEnum("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("jobs_status_run_idx").on(t.status, t.runAt)]);

/** fixed-window rate limiting without external services */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
