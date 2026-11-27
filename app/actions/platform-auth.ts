"use server";
import { redirect } from "next/navigation";
import { randomInt } from "crypto";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rootSql } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/auth";
import { platformLogout, requirePlatformAdmin } from "@/lib/platform-auth";
import { newSecret, otpauthUrl, sealSecret, openSecret, verifyCode, newRecoveryCodes, hashRecovery } from "@/lib/totp";
import type { FormState } from "./auth";

export async function platformLogoutAction() {
  await platformLogout();
  redirect("/login");
}

export async function platformChangePassword(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requirePlatformAdmin({ allowMustChange: true });
  const current = String(fd.get("current") ?? ""), pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  const [row] = await rootSql()<{ password_hash: string }[]>`select password_hash from platform_admins where id = ${a.id}`;
  if (!(await bcrypt.compare(current, row.password_hash))) return { error: "Current password is wrong." };
  if (pw !== pw2) return { error: "The new passwords don't match." };
  if (pw === current) return { error: "Choose a different password." };
  const p = passwordProblem(pw); if (p) return { error: p };
  await rootSql()`update platform_admins set password_hash = ${await hashPassword(pw)}, must_change_password = false where id = ${a.id}`;
  if (a.must_change_password) redirect("/platform");
  return { ok: "Password changed." };
}

/* ---------- two-factor for Platform accounts (same flow as hotel users) ---------- */
export async function platformStartTwoFactor() {
  const a = await requirePlatformAdmin();
  const secret = newSecret();
  await rootSql()`update platform_admins set totp_pending_secret = ${sealSecret(secret)} where id = ${a.id}`;
  const account = `${a.username}@platform`;
  const qr = await QRCode.toDataURL(otpauthUrl(secret, account, "Velkomo Signa Platform"), { margin: 1, width: 240, color: { dark: "#0F172A", light: "#FFFFFF" } });
  return { qr, secret: secret.replace(/(.{4})/g, "$1 ").trim(), account };
}
export async function platformConfirmTwoFactor(code: string) {
  const a = await requirePlatformAdmin();
  const [r] = await rootSql()<{ p: string | null }[]>`select totp_pending_secret as p from platform_admins where id = ${a.id}`;
  if (!r?.p) return { error: "Start again — the setup expired." };
  const step = verifyCode(openSecret(r.p), code, null);
  if (step === null) return { error: "That code doesn't match. Check the time on your phone is automatic and try the newest code." };
  const codes = newRecoveryCodes();
  await rootSql()`update platform_admins set totp_secret = ${r.p}, totp_pending_secret = null, totp_enabled_at = now(), totp_last_step = ${step}, recovery_codes = ${codes.map(hashRecovery)} where id = ${a.id}`;
  revalidatePath("/platform/account");
  return { ok: true as const, codes };
}
async function checkCode(id: string, code: string) {
  const [u] = await rootSql()<{ s: string | null; last: string | null; rc: string[] | null }[]>`select totp_secret as s, totp_last_step as last, recovery_codes as rc from platform_admins where id = ${id}`;
  if (!u?.s) return false;
  const step = verifyCode(openSecret(u.s), code, u.last === null ? null : Number(u.last));
  if (step !== null) { await rootSql()`update platform_admins set totp_last_step = ${step} where id = ${id}`; return true; }
  const h = hashRecovery(code);
  if ((u.rc ?? []).includes(h)) { await rootSql()`update platform_admins set recovery_codes = ${(u.rc ?? []).filter((x) => x !== h)} where id = ${id}`; return true; }
  return false;
}
export async function platformDisableTwoFactor(code: string) {
  const a = await requirePlatformAdmin();
  if (!(await checkCode(a.id, code))) return { error: "That code isn't right." };
  await rootSql()`update platform_admins set totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null where id = ${a.id}`;
  revalidatePath("/platform/account");
  return { ok: true as const };
}
export async function platformNewBackupCodes(code: string) {
  const a = await requirePlatformAdmin();
  if (!(await checkCode(a.id, code))) return { error: "That code isn't right." };
  const codes = newRecoveryCodes();
  await rootSql()`update platform_admins set recovery_codes = ${codes.map(hashRecovery)} where id = ${a.id}`;
  return { ok: true as const, codes };
}

/* ---------- managing Super Admin accounts ---------- */
function tempPassword() {
  const L = "abcdefghjkmnpqrstuvwxyz", U = "ABCDEFGHJKLMNPQRSTUVWXYZ", D = "23456789";
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[randomInt(s.length)]).join("");
  return `${pick(U, 1)}${pick(L, 4)}-${pick(D, 4)}`;
}
async function plog(actor: { id: string; name: string }, action: string, detail: string) {
  await rootSql()`insert into platform_log (actor_id, actor_name, property_code, property_name, action, detail) values (${actor.id}, ${actor.name}, '—', 'Platform', ${action}, ${detail})`;
}

export async function addPlatformAdmin(_: unknown, fd: FormData): Promise<{ error?: string; ok?: true; username?: string; password?: string }> {
  const me = await requirePlatformAdmin();
  const v = z.object({
    username: z.string().trim().min(2, "Username is required").max(40).regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dot, dash and underscore"),
    name: z.string().trim().min(1, "Full name is required").max(120),
    email: z.string().trim().email("E-mail isn't valid").or(z.literal("")),
  }).safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0].message };
  const [ex] = await rootSql()`select 1 from platform_admins where lower(username) = lower(${v.data.username})`;
  if (ex) return { error: `${v.data.username} already exists.` };
  const pw = tempPassword();
  await rootSql()`insert into platform_admins (username, name, email, password_hash, must_change_password) values (${v.data.username}, ${v.data.name}, ${v.data.email || null}, ${await hashPassword(pw)}, true)`;
  await plog(me, "Added Super Admin", v.data.username);
  revalidatePath("/platform/admins");
  return { ok: true, username: v.data.username, password: pw };
}

export async function resetPlatformAdmin(id: string, turnOff2fa: boolean) {
  const me = await requirePlatformAdmin();
  if (id === me.id) return { error: "Change your own password in My account." };
  const [a] = await rootSql()<{ username: string }[]>`select username from platform_admins where id = ${id}`;
  if (!a) return { error: "Not found." };
  const pw = tempPassword();
  await rootSql()`update platform_admins set password_hash = ${await hashPassword(pw)}, must_change_password = true, failed_logins = 0, locked_until = null where id = ${id}`;
  if (turnOff2fa) await rootSql()`update platform_admins set totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null where id = ${id}`;
  await rootSql()`delete from platform_sessions where admin_id = ${id}`;
  await plog(me, "Reset Super Admin password", a.username + (turnOff2fa ? " (two-factor turned off)" : ""));
  revalidatePath("/platform/admins");
  return { ok: true as const, username: a.username, password: pw };
}

export async function setPlatformAdminActive(id: string, active: boolean) {
  const me = await requirePlatformAdmin();
  if (id === me.id) return { error: "You can't deactivate yourself." };
  if (!active) {
    const [{ n }] = await rootSql()<{ n: number }[]>`select count(*)::int as n from platform_admins where active and id <> ${id}`;
    if (n < 1) return { error: "Keep at least one active Super Admin." };
  }
  const [a] = await rootSql()<{ username: string }[]>`update platform_admins set active = ${active} where id = ${id} returning username`;
  if (!active) await rootSql()`delete from platform_sessions where admin_id = ${id}`;
  await plog(me, active ? "Reactivated Super Admin" : "Deactivated Super Admin", a?.username ?? "");
  revalidatePath("/platform/admins");
  return { ok: true as const };
}
