import "server-only";
import type { NotifyEvent } from "./notify";
/** Implemented by the notifications module. */
export async function deliver(event: NotifyEvent): Promise<void> { void event; }
