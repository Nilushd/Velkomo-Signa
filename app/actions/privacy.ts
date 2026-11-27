"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireUser, requireAdmin, asUser, hashPassword } from "@/lib/auth";
import { rootSql, type Sql } from "@/lib/db";
import { purgeSubmissions } from "@/lib/privacy";
import { removeObjects } from "@/lib/storage";
import { sendEmail, emailLayout } from "@/lib/email";
import { appUrl } from "@/lib/env";
import type { FormState } from "./auth";

/** Admin: the organisation's privacy contact, notice, retention period and consent rule. */
export async function savePrivacy(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const v = z.object({
    contactName: z.string().trim().max(120),
    contactEmail: z.string().trim().email("Enter a valid privacy contact e-mail").or(z.literal("")),
    notice: z.string().max(20000),
    retention: z.enum(["", "12", "24", "36", "60", "84", "120"]),
    consentAll: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0].message };
  const d = v.data;
  const [cur] = await rootSql()<{ notice: string | null; retention: number | null }[]>`select privacy_notice as notice, retention_months as retention from properties where id = ${admin.property_id}`;
  const notice = d.notice.trim() || null;
  const changed = (cur?.notice ?? null) !== notice || String(cur?.retention ?? "") !== d.retention;
  await asUser(admin, (tx) => tx`update properties set privacy_contact_name = ${d.contactName || null}, privacy_contact_email = ${d.contactEmail || null},
    privacy_notice = ${notice}, retention_months = ${d.retention ? Number(d.retention) : null}, consent_all_forms = ${d.consentAll === "on"},
    privacy_version = privacy_version + ${changed ? 1 : 0}, privacy_updated_at = case when ${changed} then now() else privacy_updated_at end
    where id = ${admin.property_id}`);
  revalidatePath("/settings");
  return { ok: changed ? "Saved. The privacy notice has a new version number." : "Saved." };
}

/** Anyone: ask the organisation for a copy, a correction or deletion of their information. Logged and sent to the privacy contact and admins. */
export async function requestPrivacy(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const v = z.object({ kind: z.enum(["access", "correction", "erasure", "other"]), details: z.string().trim().max(2000) }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: "Choose what you'd like us to do." };
  if (v.data.kind !== "access" && !v.data.details) return { error: "Tell us briefly what should be corrected or deleted." };
  await asUser(u, (tx) => tx`insert into privacy_requests (property_id, user_id, requester_name, requester_email, kind, details)
    values (${u.property_id}, ${u.id}, ${u.name}, ${u.email}, ${v.data.kind}, ${v.data.details || null})`);
  const label = { access: "a copy of their information", correction: "a correction", erasure: "deletion of their information", other: "help with their information" }[v.data.kind];
  const admins = await rootSql()<{ id: string; email: string | null }[]>`select id, email from users where property_id = ${u.property_id} and is_admin and active`;
  for (const a of admins) await rootSql()`insert into notifications (property_id, user_id, title, body, url) values (${u.property_id}, ${a.id}, ${"Privacy request from " + u.name}, ${"They asked for " + label + "."}, '/settings#privacy-requests')`;
  const [p] = await rootSql()<{ email: string | null }[]>`select privacy_contact_email as email from properties where id = ${u.property_id}`;
  const to = new Set([p?.email, ...admins.map((a) => a.email)].filter((x): x is string => !!x));
  for (const addr of to) await sendEmail({ to: addr, propertyId: u.property_id, subject: `Privacy request from ${u.name}`,
    html: emailLayout({ propertyName: u.property_name, title: "New privacy request", intro: `${u.name} (@${u.username}) asked for ${label}. Most data protection laws ask for a reply within one month.`,
      rows: [["Request", label], ["Details", v.data.details || "—"]], buttons: [{ label: "Open privacy requests", url: `${appUrl()}/settings#privacy-requests` }] }) });
  revalidatePath("/settings");
  return { ok: "Sent. Your organisation will reply — usually within a month at most." };
}

/** Admin: mark a privacy request done or declined, with a note kept on record. */
export async function resolvePrivacyRequest(id: string, status: "done" | "declined", response: string) {
  const admin = await requireAdmin();
  await asUser(admin, (tx) => tx`update privacy_requests set status = ${status}, response = ${response.trim().slice(0, 2000) || null}, resolved_at = now(), resolved_by = ${admin.id}
    where id = ${id} and status = 'open'`);
  const [r] = await rootSql()<{ user_id: string | null }[]>`select user_id from privacy_requests where id = ${id}`;
  if (r?.user_id) await rootSql()`insert into notifications (property_id, user_id, title, body, url) values (${admin.property_id}, ${r.user_id}, 'Your privacy request was answered', ${response.trim().slice(0, 300) || (status === "done" ? "It has been completed." : "It was declined.")}, '/settings#your-data')`;
  revalidatePath("/settings");
  return { ok: true as const };
}

/**
 * Admin: remove a former user's identity ("right to erasure") while keeping business records that the organisation
 * may be required to keep. Optionally also delete the requests they submitted, with their attachments.
 */
export async function anonymiseUser(userId: string, alsoRequests: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You can't anonymise your own account." };
  const [u] = await rootSql()<{ property_id: string; name: string }[]>`select property_id, name from users where id = ${userId}`;
  if (!u || u.property_id !== admin.property_id) return { error: "Only the person's own organisation can do this." };
  const tag = randomBytes(3).toString("hex");
  const sql = rootSql();
  let removedFiles: string[] = [];
  await sql.begin(async (tx) => {
    if (alsoRequests) {
      const subs = await tx<{ id: string }[]>`select id from submissions where submitter_id = ${userId}`;
      removedFiles = await purgeSubmissions(tx as unknown as Sql, subs.map((x) => x.id));
    } else {
      await tx`update submissions set submitter_name = null, submitter_email = null where submitter_id = ${userId}`;
    }
    await tx`update users set name = ${"Former user " + tag}, username = ${"former-" + tag}, email = null, department = null,
      password_hash = ${await hashPassword(randomBytes(24).toString("base64url"))}, active = false, is_admin = false, can_build_forms = false,
      totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null, email_approvals = false
      where id = ${userId}`;
    for (const t of ["sessions", "login_events", "notifications", "push_subscriptions", "group_members", "form_access", "user_properties", "login_challenges", "password_resets"])
      await tx.unsafe(`delete from ${t} where user_id = $1`, [userId]);
  });
  await removeObjects(removedFiles);
  revalidatePath("/users");
  redirect("/users?anonymised=1");
}

/** Everyone: recent sign-ins, for spotting anything unexpected. */
export async function mySignIns() {
  const u = await requireUser();
  return rootSql()<{ at: Date; ip_prefix: string | null; user_agent: string | null; method: string }[]>`
    select at, ip_prefix, user_agent, method from login_events where user_id = ${u.id} order by at desc limit 10`;
}
