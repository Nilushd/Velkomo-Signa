import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { rootSql } from "./db";
import { randomToken, sha256 } from "./crypto";

/**
 * Platform (Super Admin) sign-in — separate accounts, sessions and cookies from the hotel app.
 * A hotel session never opens the Platform and a Platform session never opens a hotel.
 */
/** Typed in the Property code box on the normal login page. Reserved — no hotel can use it. */
export const PLATFORM_CODE = "PLATFORM";
export const isPlatformCode = (c: string) => c.trim().toUpperCase() === PLATFORM_CODE;
export const PLATFORM_COOKIE = "signa_platform";
export const PLATFORM_2FA_COOKIE = "signa_platform_2fa";
const SESSION_HOURS = 12;
const ERROR = "Invalid username or password";
const DUMMY = bcrypt.hashSync("not-a-real-password", 10);

export type PlatformAdmin = { id: string; username: string; name: string; email: string | null; must_change_password: boolean; totp_enabled: boolean };

async function secure() {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
}

async function startSession(adminId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await rootSql()`insert into platform_sessions (token_hash, admin_id, expires_at) values (${sha256(token)}, ${adminId}, ${expires})`;
  (await cookies()).set(PLATFORM_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: await secure(), path: "/", expires });
}

export async function platformLogin(username: string, password: string):
  Promise<{ ok: true; twoFactor: boolean; mustChange: boolean } | { ok: false; error: string }> {
  const sql = rootSql();
  const [a] = await sql<{ id: string; password_hash: string; locked_until: Date | null; must_change_password: boolean; totp_on: boolean }[]>`
    select id, password_hash, locked_until, must_change_password, (totp_enabled_at is not null and totp_secret is not null) as totp_on
    from platform_admins where lower(username) = lower(${username.trim()}) and active`;
  if (!a) { await bcrypt.compare(password, DUMMY); return { ok: false, error: ERROR }; }
  if (a.locked_until && a.locked_until > new Date()) return { ok: false, error: ERROR };
  if (!(await bcrypt.compare(password, a.password_hash))) {
    await sql`update platform_admins set
      failed_logins = case when failed_logins + 1 >= 5 then 0 else failed_logins + 1 end,
      locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end where id = ${a.id}`;
    return { ok: false, error: ERROR };
  }
  await sql`update platform_admins set failed_logins = 0, locked_until = null where id = ${a.id}`;
  if (a.totp_on) {
    const token = randomToken();
    await sql`insert into platform_challenges (token_hash, admin_id, expires_at) values (${sha256(token)}, ${a.id}, now() + interval '10 minutes')`;
    (await cookies()).set(PLATFORM_2FA_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: await secure(), path: "/", maxAge: 600 });
    return { ok: true, twoFactor: true, mustChange: a.must_change_password };
  }
  await startSession(a.id);
  return { ok: true, twoFactor: false, mustChange: a.must_change_password };
}

export async function pendingPlatformTwoFactor() {
  const token = (await cookies()).get(PLATFORM_2FA_COOKIE)?.value;
  if (!token) return null;
  const [c] = await rootSql()<{ name: string }[]>`select a.name from platform_challenges c join platform_admins a on a.id = c.admin_id
    where c.token_hash = ${sha256(token)} and c.expires_at > now() and c.attempts < 5 and a.active`;
  return c ?? null;
}

export async function completePlatformTwoFactor(code: string):
  Promise<{ ok: true; mustChange: boolean } | { ok: false; error: string; restart?: boolean }> {
  const { verifyCode, openSecret, hashRecovery } = await import("./totp");
  const c = await cookies();
  const token = c.get(PLATFORM_2FA_COOKIE)?.value;
  const sql = rootSql();
  if (!token) return { ok: false, error: "Sign-in timed out.", restart: true };
  const [ch] = await sql<{ id: string; admin_id: string; attempts: number }[]>`select id, admin_id, attempts from platform_challenges where token_hash = ${sha256(token)} and expires_at > now()`;
  if (!ch || ch.attempts >= 5) { c.delete(PLATFORM_2FA_COOKIE); return { ok: false, error: "Sign-in timed out.", restart: true }; }
  const [a] = await sql<{ s: string | null; last: string | null; rc: string[] | null; must: boolean }[]>`
    select totp_secret as s, totp_last_step as last, recovery_codes as rc, must_change_password as must from platform_admins where id = ${ch.admin_id} and active`;
  if (!a?.s) { c.delete(PLATFORM_2FA_COOKIE); return { ok: false, error: "Please sign in again.", restart: true }; }
  const entered = code.trim();
  const step = verifyCode(openSecret(a.s), entered, a.last === null ? null : Number(a.last));
  if (step !== null) await sql`update platform_admins set totp_last_step = ${step} where id = ${ch.admin_id}`;
  else if ((a.rc ?? []).includes(hashRecovery(entered))) await sql`update platform_admins set recovery_codes = ${(a.rc ?? []).filter((h) => h !== hashRecovery(entered))} where id = ${ch.admin_id}`;
  else {
    const [x] = await sql<{ attempts: number }[]>`update platform_challenges set attempts = attempts + 1 where id = ${ch.id} returning attempts`;
    if (x.attempts >= 5) { await sql`delete from platform_challenges where id = ${ch.id}`; c.delete(PLATFORM_2FA_COOKIE); return { ok: false, error: "Too many wrong codes.", restart: true }; }
    return { ok: false, error: `That code isn't right. ${5 - x.attempts} ${5 - x.attempts === 1 ? "try" : "tries"} left.` };
  }
  await sql`delete from platform_challenges where id = ${ch.id}`;
  c.delete(PLATFORM_2FA_COOKIE);
  await startSession(ch.admin_id);
  return { ok: true, mustChange: a.must };
}

export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const [a] = await rootSql()<PlatformAdmin[]>`
    select a.id, a.username, a.name, a.email, a.must_change_password, (a.totp_enabled_at is not null) as totp_enabled
    from platform_sessions s join platform_admins a on a.id = s.admin_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and a.active`;
  return a ?? null;
});

/** Pages and actions of the Platform module. */
export async function requirePlatformAdmin(opts: { allowMustChange?: boolean } = {}) {
  const a = await getPlatformAdmin();
  if (!a) redirect("/login");
  if (a.must_change_password && !opts.allowMustChange) redirect("/platform/change-password");
  return a;
}

export async function platformLogout() {
  const c = await cookies();
  const token = c.get(PLATFORM_COOKIE)?.value;
  if (token) await rootSql()`delete from platform_sessions where token_hash = ${sha256(token)}`;
  c.delete(PLATFORM_COOKIE);
}
