import "server-only";
import { schema, type Executor } from "@/db/client";

export async function audit(exec: Executor, e: { workspaceId: string; actorId: string; action: string; entity: string; entityId?: string | null; diff?: Record<string, unknown> }) {
  await exec.insert(schema.auditLog).values({ workspaceId: e.workspaceId, actorId: e.actorId, action: e.action, entity: e.entity, entityId: e.entityId ?? null, diff: e.diff ?? null });
}
