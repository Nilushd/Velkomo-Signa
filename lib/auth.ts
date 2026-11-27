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
export async function login(propertyCode: string, username: string, password: string):
  Promise<{ ok: true; mustChange: boolean } | { ok: false; error: string }> {
  const sql = rootSql();
  const [u] = await sql<{ id: string; password_hash: string; locked_until: Date | null; failed_logins: number; must_change_password: boolean }[]>`
    select u.id, u.password_hash, u.locked_until, u.failed_logins, u.must_change_password
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
  await createSession(u.id);
  return { ok: true, mustChange: u.must_change_password };
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
           u.can_build_forms, u.can_use_studio, u.can_use_ai, u.email_approvals, u.must_change_password,
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
