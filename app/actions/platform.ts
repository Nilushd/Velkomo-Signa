"use server";
import { revalidatePath } from "next/cache";
import { randomInt } from "crypto";
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth";
import { requirePlatformAdmin, type PlatformAdmin } from "@/lib/platform-auth";
import { rootSql } from "@/lib/db";
import { removeObjects } from "@/lib/storage";
import type { FormState } from "./auth";

/** Platform module: Super Admins only. All reads/writes use the privileged connection (they work across hotels). */
const requireSuper = () => requirePlatformAdmin();

async function log(u: PlatformAdmin, prop: { property_code: string; name: string }, action: string, detail?: string | null) {
  await rootSql()`insert into platform_log (actor_id, actor_name, property_code, property_name, action, detail)
    values (${u.id}, ${u.name}, ${prop.property_code}, ${prop.name}, ${action}, ${detail ?? null})`;
}

async function getProp(id: string) {
  const [p] = await rootSql()<{ id: string; property_code: string; name: string; active: boolean; ends: string | null }[]>`
    select id, property_code, name, active, to_char(subscription_ends, 'YYYY-MM-DD') as ends from properties where id = ${id}`;
  if (!p) throw new Error("Hotel not found");
  return p;
}

/** A readable temporary password (letters + digits, no look-alikes). */
function tempPassword() {
  const L = "abcdefghjkmnpqrstuvwxyz", U = "ABCDEFGHJKLMNPQRSTUVWXYZ", D = "23456789";
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[randomInt(s.length)]).join("");
  return `${pick(U, 1)}${pick(L, 4)}-${pick(D, 4)}`;
}

const dateOrEmpty = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date").or(z.literal(""));
const day = (d: string | null) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "no end date";

export async function createHotel(_: FormState, fd: FormData): Promise<FormState & { id?: string; password?: string; username?: string; code?: string }> {
  const u = await requireSuper();
  const p = z.object({
    code: z.string().trim().min(2, "Property code needs 2–20 characters").max(20).regex(/^[A-Za-z0-9_-]+$/, "Code can use letters, numbers, dash and underscore"),
    name: z.string().trim().min(1, "Hotel name is required").max(120),
    ends: dateOrEmpty,
    limit: z.string().trim().regex(/^\d{0,4}$/, "Form types allowed must be a whole number").optional().default(""),
    notes: z.string().max(1000).optional().default(""),
    adminUsername: z.string().trim().min(2, "Admin username is required").max(40).regex(/^[a-zA-Z0-9._-]+$/, "Admin username can use letters, numbers, dot, dash and underscore"),
    adminName: z.string().trim().min(1, "Admin name is required").max(120),
    adminEmail: z.string().trim().email("Admin e-mail isn't valid").or(z.literal("")),
    adminPassword: z.string().optional().default(""),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const pw = p.data.adminPassword.trim() || tempPassword();
  const prob = passwordProblem(pw);
  if (prob) return { error: `Admin password: ${prob}` };
  const sql = rootSql();
  const code = p.data.code.toUpperCase();
  if (code === "PLATFORM") return { error: "PLATFORM is reserved for Super Admin sign-in. Choose another code." };
  const [ex] = await sql`select 1 from properties where lower(property_code) = lower(${code})`;
  if (ex) return { error: `The property code ${code} is already used.` };
  const hash = await hashPassword(pw);
  const id = await sql.begin(async (tx) => {
    const [prop] = await tx<{ id: string }[]>`insert into properties (property_code, name, subscription_ends, notes, form_type_limit)
      values (${code}, ${p.data.name}, ${p.data.ends || null}, ${p.data.notes.trim() || null}, ${p.data.limit === "" ? null : Number(p.data.limit)}) returning id`;
    await tx`insert into users (property_id, username, name, email, password_hash, is_admin, can_build_forms, can_use_studio, can_use_ai, must_change_password)
      values (${prop.id}, ${p.data.adminUsername}, ${p.data.adminName}, ${p.data.adminEmail || null}, ${hash}, true, true, true, true, true)`;
    return prop.id;
  });
  await log(u, { property_code: code, name: p.data.name }, "Created hotel", `Admin ${p.data.adminUsername}; subscription ${day(p.data.ends || null)}; ${p.data.limit === "" ? "unlimited form types" : `${p.data.limit} form types`}`);
  revalidatePath("/platform");
  return { ok: "created", id, password: pw, username: p.data.adminUsername, code };
}

export async function updateHotel(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await requireSuper();
  const before = await getProp(id);
  const p = z.object({ name: z.string().trim().min(1, "Hotel name is required").max(120), notes: z.string().max(1000).optional().default("") }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  await rootSql()`update properties set name = ${p.data.name}, notes = ${p.data.notes.trim() || null} where id = ${id}`;
  if (before.name !== p.data.name) await log(u, { ...before, name: p.data.name }, "Renamed hotel", `${before.name} → ${p.data.name}`);
  revalidatePath("/platform");
  return { ok: "Saved." };
}

/** Set (or clear) the last day of the subscription. */
export async function setSubscription(id: string, ends: string | null) {
  const u = await requireSuper();
  if (ends !== null && !/^\d{4}-\d{2}-\d{2}$/.test(ends)) return { error: "Choose a valid date." };
  const p = await getProp(id);
  await rootSql()`update properties set subscription_ends = ${ends} where id = ${id}`;
  await log(u, p, "Subscription end date", `${day(p.ends)} → ${day(ends)}`);
  revalidatePath("/platform");
  return { ok: true as const };
}

/** Plan: how many form types the hotel may have enabled at once (null = unlimited). Submissions are always unlimited. */
export async function setFormTypeLimit(id: string, limit: number | null) {
  const u = await requireSuper();
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 9999)) return { error: "Enter a whole number, or leave it empty for unlimited." };
  const p = await getProp(id);
  const [b] = await rootSql()<{ lim: number | null; n: number }[]>`select form_type_limit as lim, (select count(*)::int from forms where property_id = ${id} and status = 'published') as n from properties where id = ${id}`;
  await rootSql()`update properties set form_type_limit = ${limit} where id = ${id}`;
  await log(u, p, "Form type limit", `${b.lim ?? "unlimited"} → ${limit ?? "unlimited"}`);
  revalidatePath("/platform");
  return { ok: true as const, over: limit !== null && b.n > limit ? b.n - limit : 0 };
}

export async function setHotelActive(id: string, active: boolean) {
  const u = await requireSuper();
  const p = await getProp(id);
  await rootSql()`update properties set active = ${active} where id = ${id}`;
  if (!active) await rootSql()`delete from sessions where user_id in (select id from users where property_id = ${id})`;
  await log(u, p, active ? "Resumed hotel" : "Suspended hotel");
  revalidatePath("/platform");
  return { ok: true as const };
}

/** Reset an admin's password: a temporary one (shown once), must be changed at next sign-in; unlocks and signs out. */
export async function resetAdminPassword(propertyId: string, userId: string, opts: { password?: string; turnOff2fa?: boolean }) {
  const u = await requireSuper();
  const p = await getProp(propertyId);
  const [a] = await rootSql()<{ username: string; is_admin: boolean }[]>`select username, is_admin from users where id = ${userId} and property_id = ${propertyId}`;
  if (!a?.is_admin) return { error: "That account isn't an admin of this hotel." };
  const pw = opts.password?.trim() || tempPassword();
  const prob = passwordProblem(pw);
  if (prob) return { error: prob };
  await rootSql()`update users set password_hash = ${await hashPassword(pw)}, must_change_password = true, failed_logins = 0, locked_until = null, active = true where id = ${userId}`;
  if (opts.turnOff2fa) await rootSql()`update users set totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null where id = ${userId}`;
  await rootSql()`delete from sessions where user_id = ${userId}`;
  await log(u, p, "Reset admin password", `${a.username}${opts.turnOff2fa ? " (two-factor turned off)" : ""}`);
  revalidatePath("/platform");
  return { ok: true as const, password: pw, username: a.username };
}

/** Add another admin to a hotel (or make the first one again). */
export async function createAdmin(propertyId: string, _: unknown, fd: FormData): Promise<{ error?: string; ok?: true; password?: string; username?: string }> {
  const u = await requireSuper();
  const p = await getProp(propertyId);
  const v = z.object({
    username: z.string().trim().min(2, "Username is required").max(40).regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dot, dash and underscore"),
    name: z.string().trim().min(1, "Full name is required").max(120),
    email: z.string().trim().email("E-mail isn't valid").or(z.literal("")),
    password: z.string().optional().default(""),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0].message };
  const [ex] = await rootSql()`select 1 from users where property_id = ${propertyId} and lower(username) = lower(${v.data.username})`;
  if (ex) return { error: `${v.data.username} already exists in ${p.property_code}. Use Reset password instead.` };
  const pw = v.data.password.trim() || tempPassword();
  const prob = passwordProblem(pw);
  if (prob) return { error: prob };
  await rootSql()`insert into users (property_id, username, name, email, password_hash, is_admin, can_build_forms, can_use_studio, can_use_ai, must_change_password)
    values (${propertyId}, ${v.data.username}, ${v.data.name}, ${v.data.email || null}, ${await hashPassword(pw)}, true, true, true, true, true)`;
  await log(u, p, "Created admin", v.data.username);
  revalidatePath("/platform");
  return { ok: true, password: pw, username: v.data.username };
}

/** Permanently delete a hotel with all its users, forms, requests and files. The code must be typed to confirm. */
export async function deleteHotel(id: string, confirmCode: string) {
  const u = await requireSuper();
  const p = await getProp(id);
  if (confirmCode.trim().toUpperCase() !== p.property_code.toUpperCase()) return { error: `Type ${p.property_code} to confirm.` };
  const sql = rootSql();
  const keys = (await sql<{ k: string }[]>`select storage_key as k from files where property_id = ${id} and storage_key is not null`).map((r) => r.k);
  const [c] = await sql<{ users: number; forms: number; subs: number }[]>`select (select count(*)::int from users where property_id = ${id}) as users,
    (select count(*)::int from forms where property_id = ${id}) as forms, (select count(*)::int from submissions where property_id = ${id}) as subs`;
  await sql`delete from properties where id = ${id}`;
  for (let i = 0; i < keys.length; i += 500) await removeObjects(keys.slice(i, i + 500));
  await log(u, p, "Deleted hotel", `${c.users} users, ${c.forms} forms, ${c.subs} requests, ${keys.length} stored files`);
  revalidatePath("/platform");
  return { ok: true as const };
}

/* ---------- contracts & billing ---------- */
const amount = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.00");
const optAmount = amount.or(z.literal(""));

export async function saveBillingSettings(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireSuper();
  const v = z.object({
    currency: z.enum(["LKR", "USD", "EUR", "GBP", "INR", "AED", "MVR"]),
    rate: amount, minimum: amount,
    tax: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Tax must be a number").refine((x) => Number(x) <= 100, "Tax can't be over 100%"),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0].message };
  await rootSql()`update billing_settings set currency = ${v.data.currency}, rate_per_form = ${v.data.rate}, minimum_monthly = ${v.data.minimum}, tax_pct = ${v.data.tax}, updated_at = now() where id = 1`;
  await rootSql()`insert into platform_log (actor_id, actor_name, property_code, property_name, action, detail)
    values (${u.id}, ${u.name}, '—', 'Platform', 'Default pricing', ${`${v.data.currency} ${v.data.rate} per form / month, minimum ${v.data.minimum}, tax ${v.data.tax}%`})`;
  revalidatePath("/platform/billing");
  return { ok: "Pricing saved." };
}

export async function saveContract(propertyId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await requireSuper();
  const p = await getProp(propertyId);
  const v = z.object({
    contract_no: z.string().trim().max(60), starts_on: dateOrEmpty, cycle: z.enum(["monthly", "quarterly", "annual"]),
    rate: optAmount, minimum: optAmount,
    discount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Discount must be a number").refine((x) => Number(x) <= 100, "Discount can't be over 100%").or(z.literal("")),
    contact_name: z.string().trim().max(120), contact_email: z.string().trim().email("Billing e-mail isn't valid").or(z.literal("")),
    notes: z.string().max(1000),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0].message };
  const d = v.data;
  await rootSql()`insert into hotel_contracts (property_id, contract_no, starts_on, cycle, rate_per_form, minimum_monthly, discount_pct, contact_name, contact_email, notes, updated_at)
    values (${propertyId}, ${d.contract_no || null}, ${d.starts_on || null}, ${d.cycle}, ${d.rate || null}, ${d.minimum || null}, ${d.discount || 0}, ${d.contact_name || null}, ${d.contact_email || null}, ${d.notes.trim() || null}, now())
    on conflict (property_id) do update set contract_no = excluded.contract_no, starts_on = excluded.starts_on, cycle = excluded.cycle, rate_per_form = excluded.rate_per_form,
      minimum_monthly = excluded.minimum_monthly, discount_pct = excluded.discount_pct, contact_name = excluded.contact_name, contact_email = excluded.contact_email, notes = excluded.notes, updated_at = now()`;
  await log(u, p, "Contract updated", [d.contract_no && `No. ${d.contract_no}`, d.cycle, d.rate ? `rate ${d.rate}` : "default rate", d.discount && Number(d.discount) > 0 ? `${d.discount}% discount` : null].filter(Boolean).join(", "));
  revalidatePath("/platform/billing");
  return { ok: "Contract saved." };
}
