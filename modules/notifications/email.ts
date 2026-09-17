import { getDb, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { log } from "@/modules/shared/log";

export type Email = { to: string; subject: string; html: string; workspaceId?: string | null };

/**
 * Every email is written to `outbox` first. With RESEND_API_KEY it is delivered through Resend;
 * without a key it stays there with status "logged" so local development needs no mail provider.
 */
export async function sendEmail(mail: Email): Promise<void> {
  const db = await getDb();
  const [row] = await db.insert(schema.outbox).values({ to: mail.to, subject: mail.subject, html: mail.html, workspaceId: mail.workspaceId ?? null }).returning({ id: schema.outbox.id });
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await db.update(schema.outbox).set({ status: "logged" }).where(eq(schema.outbox.id, row.id));
    log.info("email_logged", { to: mail.to, subject: mail.subject });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "TutorLab <onboarding@resend.dev>", to: mail.to, subject: mail.subject, html: mail.html }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    await db.update(schema.outbox).set({ status: "sent", sentAt: new Date() }).where(eq(schema.outbox.id, row.id));
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(schema.outbox).set({ status: "failed", error }).where(eq(schema.outbox.id, row.id));
    log.error("email_failed", { to: mail.to, error });
  }
}

/** Minimal, inline-styled wrapper so every transactional email looks the same. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:32px">
    <div style="font-weight:600;font-size:15px;color:#6e6e73;margin-bottom:20px">TutorLab</div>
    <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#1d1d1f;letter-spacing:-.02em">${title}</h1>
    <div style="font-size:16px;line-height:1.55;color:#424245">${bodyHtml}</div>
    ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:24px;background:#0071e3;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">${cta.label}</a>` : ""}
  </div></div>`;
}
