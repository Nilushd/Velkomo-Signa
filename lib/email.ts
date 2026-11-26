import { rootSql } from "./db";

export interface Email {
  to: string;
  subject: string;
  html: string;
  propertyId?: string | null;
}

const FROM = () => process.env.EMAIL_FROM || "Velkomo Signa <signa@example.com>";

/** One small helper so Resend can be swapped for SMTP (or the dev console log). */
export async function sendEmail(mail: Email): Promise<void> {
  let status = "logged";
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM(), to: [mail.to], subject: mail.subject, html: mail.html }),
      });
      status = r.ok ? "sent" : `error ${r.status}`;
    } else if (process.env.SMTP_HOST) {
      const nodemailer = await import("nodemailer");
      const t = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await t.sendMail({ from: FROM(), to: mail.to, subject: mail.subject, html: mail.html });
      status = "sent";
    } else if (process.env.NODE_ENV !== "test") {
      console.log(`[email] to=${mail.to} subject="${mail.subject}" (no RESEND_API_KEY/SMTP_HOST, logged only)`);
    }
  } catch (e) {
    status = "error";
    console.error("[email] failed", e);
  }
  try {
    await rootSql()`insert into email_log (property_id, to_address, subject, html, status)
      values (${mail.propertyId ?? null}, ${mail.to}, ${mail.subject}, ${mail.html}, ${status})`;
  } catch { /* logging must never break the request */ }
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export interface EmailButton { label: string; url: string; color?: string }

export function emailLayout(opts: { title: string; intro?: string; rows?: [string, string][]; buttons?: EmailButton[]; footer?: string; propertyName?: string }) {
  const rows = (opts.rows ?? []).map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6B6A85;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#18172B;font-size:14px">${esc(v)}</td></tr>`).join("");
  const buttons = (opts.buttons ?? []).map((b) =>
    `<a href="${esc(b.url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:11px 20px;border-radius:8px;background:${b.color ?? "#4F46E5"};color:#fff;font-weight:600;font-size:14px;text-decoration:none">${esc(b.label)}</a>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#F5F5FB;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;border:1px solid #E4E4F0">
<tr><td style="padding:20px 24px;border-bottom:1px solid #EEEEF6;font-weight:700;color:#1E1B4B;font-size:15px">velkomo <span style="color:#4F46E5">signa</span>${opts.propertyName ? ` <span style="color:#6B6A85;font-weight:500">· ${esc(opts.propertyName)}</span>` : ""}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:20px;color:#18172B">${esc(opts.title)}</h1>
${opts.intro ? `<p style="margin:0 0 16px;color:#3F3E57;font-size:14px;line-height:1.5">${esc(opts.intro)}</p>` : ""}
${rows ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px">${rows}</table>` : ""}
${buttons}
${opts.footer ? `<p style="margin:18px 0 0;color:#8A89A0;font-size:12px;line-height:1.5">${esc(opts.footer)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}
