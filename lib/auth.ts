import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { rootSql, tenant, type Sql } from "./db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "signa_session";
const SESSION_DAYS = 14;
export const LOGIN_ERROR = "Invalid property code, username or password";
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export interface SessionUser {
  id: string;
  property_id: string;
  username: string;
  name: string;
  email: string | null;
  department: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  can_build_forms: boolean;
  can_use_studio: boolean;
  can_use_ai: boolean;
  email_approvals: boolean;
  totp_enabled: boolean;
  must_change_password: boolean;
  property_code: string;
  property_name: string;
  property_logo: string | null;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password needs at least one letter and one number.";
  return null;
}

/** Property code + username + password. Always the same error for any failure. */
export const TWOFA_COOKIE = "signa_2fa";

export async function login(propertyCode: string, username: string, password: string):
  Promise<{ ok: true; mustChange: boolean; twoFactor: boolean } | { ok: false; error: string }> {
  const sql = rootSql();
  const [u] = await sql<{ id: string; password_hash: string; locked_until: Date | null; failed_logins: number; must_change_password: boolean; totp_on: boolean }[]>`
    select u.id, u.password_hash, u.locked_until, u.failed_logins, u.must_change_password, (u.totp_enabled_at is not null and u.totp_secret is not null) as totp_on
    from users u join properties p on p.id = u.property_id
    where lower(p.property_code) = lower(${propertyCode.trim()}) and p.active
      and lower(u.username) = lower(${username.trim()}) and u.active`;
  if (!u) {
    await bcrypt.compare(password, DUMMY_HASH); // keep timing similar
    return { ok: false, error: LOGIN_ERROR };
  }
  if (u.locked_until && u.locked_until > new Date()) {
    return { ok: false, error: LOGIN_ERROR };
  }
  const good = await bcrypt.compare(password, u.password_hash);
  if (!good) {
    await sql`
      update users set
        failed_logins = case when failed_logins + 1 >= 5 then 0 else failed_logins + 1 end,
        locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end
      where id = ${u.id}`;
    return { ok: false, error: LOGIN_ERROR };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  if (u.totp_on) {
    // password is right; the 6-digit code comes next (10 minutes, 5 tries)
    const token = randomToken();
    await sql`insert into login_challenges (token_hash, user_id, expires_at) values (${sha256(token)}, ${u.id}, now() + interval '10 minutes')`;
    const h = await headers();
    (await cookies()).set(TWOFA_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
      secure: (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production" });
    return { ok: true, mustChange: u.must_change_password, twoFactor: true };
  }
  await createSession(u.id);
  return { ok: true, mustChange: u.must_change_password, twoFactor: false };
}

/** Is there a sign-in waiting for its 6-digit code? */
export async function pendingTwoFactor() {
  const token = (await cookies()).get(TWOFA_COOKIE)?.value;
  if (!token) return null;
  const [c] = await rootSql()<{ id: string; name: string }[]>`
    select c.id, u.name from login_challenges c join users u on u.id = c.user_id
    where c.token_hash = ${sha256(token)} and c.expires_at > now() and c.attempts < 5 and u.active`;
  return c ?? null;
}

/** Second step: an authenticator code (or a backup code) for the waiting sign-in. */
export async function completeTwoFactor(code: string): Promise<{ ok: true; mustChange: boolean; usedBackup: boolean; backupLeft: number } | { ok: false; error: string; restart?: boolean }> {
  const { verifyCode, openSecret, hashRecovery } = await import("./totp");
  const c = await cookies();
  const token = c.get(TWOFA_COOKIE)?.value;
  const sql = rootSql();
  if (!token) return { ok: false, error: "Your sign-in timed out. Please sign in again.", restart: true };
  const [ch] = await sql<{ id: string; user_id: string; attempts: number }[]>`
    select id, user_id, attempts from login_challenges where token_hash = ${sha256(token)} and expires_at > now()`;
  if (!ch || ch.attempts >= 5) { c.delete(TWOFA_COOKIE); return { ok: false, error: "Your sign-in timed out. Please sign in again.", restart: true }; }
  const [u] = await sql<{ totp_secret: string; totp_last_step: string | null; recovery_codes: string[] | null; must_change_password: boolean }[]>`
    select totp_secret, totp_last_step, recovery_codes, must_change_password from users where id = ${ch.user_id} and active`;
  if (!u?.totp_secret) { c.delete(TWOFA_COOKIE); return { ok: false, error: "Please sign in again.", restart: true }; }
  const entered = code.trim();
  let usedBackup = false; let backupLeft = u.recovery_codes?.length ?? 0;
  const step = verifyCode(openSecret(u.totp_secret), entered, u.totp_last_step === null ? null : Number(u.totp_last_step));
  if (step !== null) {
    await sql`update users set totp_last_step = ${step} where id = ${ch.user_id}`;
  } else if (/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(entered) && (u.recovery_codes ?? []).includes(hashRecovery(entered))) {
    const left = (u.recovery_codes ?? []).filter((h) => h !== hashRecovery(entered));
    await sql`update users set recovery_codes = ${left} where id = ${ch.user_id}`;
    usedBackup = true; backupLeft = left.length;
  } else {
    const [a] = await sql<{ attempts: number }[]>`update login_challenges set attempts = attempts + 1 where id = ${ch.id} returning attempts`;
    if (a.attempts >= 5) { await sql`delete from login_challenges where id = ${ch.id}`; c.delete(TWOFA_COOKIE); return { ok: false, error: "Too many wrong codes. Please sign in again.", restart: true }; }
    return { ok: false, error: `That code isn't right. ${5 - a.attempts} ${5 - a.attempts === 1 ? "try" : "tries"} left.` };
  }
  await sql`delete from login_challenges where id = ${ch.id}`;
  c.delete(TWOFA_COOKIE);
  await createSession(ch.user_id);
  return { ok: true, mustChange: u.must_change_password, usedBackup, backupLeft };
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await rootSql()`insert into sessions (token_hash, user_id, expires_at) values (${sha256(token)}, ${userId}, ${expires})`;
  const h = await headers();
  const secure = (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure, path: "/", expires,
  });
}

export async function logout() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await rootSql()`delete from sessions where token_hash = ${sha256(token)}`;
  c.delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await rootSql()<SessionUser[]>`
    select u.id, u.property_id, u.username, u.name, u.email, u.department, u.is_admin, u.is_super_admin,
           u.can_build_forms, u.can_use_studio, u.can_use_ai, u.email_approvals, (u.totp_enabled_at is not null) as totp_enabled, u.must_change_password,
           p.property_code, p.name as property_name, p.logo_file_id as property_logo
    from sessions s join users u on u.id = s.user_id join properties p on p.id = u.property_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and u.active and p.active`;
  return u ?? null;
});

/** For pages: must be signed in (and not stuck on a temporary password). */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<SessionUser> {
  const u = await getSession();
  if (!u) redirect("/login");
  if (u.must_change_password && !opts.allowMustChange) redirect("/change-password");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!u.is_admin) redirect("/");
  return u;
}

/** Feature access: admins always; others when the admin switched it on for them. */
export const canBuild = (u: SessionUser) => u.is_admin || u.can_build_forms;
/** One permission — Form designer — covers the builder, Form Studio and (when the server has a key) AI design. */
export const canStudio = canBuild;
export const canAi = (u: SessionUser) => !!process.env.ANTHROPIC_API_KEY && canBuild(u);

export async function requireStudio() {
  const u = await requireUser();
  if (!canStudio(u)) redirect("/forms?denied=studio");
  return u;
}

export async function requireBuilder() {
  const u = await requireUser();
  if (!u.is_admin && !u.can_build_forms) redirect("/");
  return u;
}

/** Tenant transaction scoped to the signed-in user (RLS applies). Admins get property-wide scope. */
export function asUser<T>(u: SessionUser, fn: (tx: Sql) => Promise<T>) {
  return tenant({ propertyId: u.property_id, userId: u.id, isAdmin: u.is_admin }, fn);
}
/** Property-wide scope (server-side engine work after the app has checked permissions). */
export function asSystem<T>(propertyId: string, fn: (tx: Sql) => Promise<T>) {
  return tenant({ propertyId, userId: null }, fn);
}
