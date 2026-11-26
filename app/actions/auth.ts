"use server";
import { redirect } from "next/navigation";
import { rootSql } from "@/lib/db";
import { login, logout, getSession, hashPassword, passwordProblem, createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendEmail, emailLayout } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export type FormState = { error?: string; ok?: string } | undefined;

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit(`login:${await clientIp()}`, 30, 600))) return { error: "Too many attempts. Try again in a few minutes." };
  const r = await login(String(fd.get("property") ?? ""), String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  const next = String(fd.get("next") ?? "");
  redirect(r.mustChange ? "/change-password" : next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await getSession();
  if (!u) redirect("/login");
  const current = String(fd.get("current") ?? ""), pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  const [row] = await rootSql()<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
  if (!(await bcrypt.compare(current, row.password_hash))) return { error: "Current password is wrong." };
  if (pw !== pw2) return { error: "The new passwords don't match." };
  if (pw === current) return { error: "Choose a password different from the temporary one." };
  const p = passwordProblem(pw);
  if (p) return { error: p };
  await rootSql()`update users set password_hash = ${await hashPassword(pw)}, must_change_password = false where id = ${u.id}`;
  await rootSql()`delete from sessions where user_id = ${u.id}`;
  await createSession(u.id);
  redirect("/?pw=changed");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit(`forgot:${await clientIp()}`, 10, 3600))) return { error: "Too many requests. Try again later." };
  const pc = String(fd.get("property") ?? "").trim(), un = String(fd.get("username") ?? "").trim();
  const [u] = await rootSql()<{ id: string; email: string | null; name: string; property_id: string; pname: string }[]>`
    select u.id, u.email, u.name, u.property_id, p.name as pname from users u join properties p on p.id = u.property_id
    where lower(p.property_code) = lower(${pc}) and p.active and lower(u.username) = lower(${un}) and u.active`;
  if (u && !u.email) return { ok: "Your account has no e-mail address. Please contact your admin to reset your password." };
  if (u?.email) {
    const token = randomToken();
    await rootSql()`insert into password_resets (user_id, token_hash, expires_at) values (${u.id}, ${sha256(token)}, now() + interval '1 hour')`;
    await sendEmail({ to: u.email, propertyId: u.property_id, subject: "Reset your Velkomo Signa password",
      html: emailLayout({ propertyName: u.pname, title: "Reset your password", intro: `Hi ${u.name}, use the button below to choose a new password. The link works once and expires in 1 hour.`,
        buttons: [{ label: "Choose a new password", url: `${appUrl()}/reset-password/${token}` }], footer: "If you didn't ask for this, you can ignore this e-mail." }) });
  }
  return { ok: "If the account has an e-mail address, a reset link is on its way. Otherwise, please contact your admin." };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? ""), pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  if (pw !== pw2) return { error: "The passwords don't match." };
  const p = passwordProblem(pw);
  if (p) return { error: p };
  const [r] = await rootSql()<{ id: string; user_id: string }[]>`
    select id, user_id from password_resets where token_hash = ${sha256(token)} and used_at is null and expires_at > now()`;
  if (!r) return { error: "This reset link is invalid or has expired." };
  await rootSql()`update password_resets set used_at = now() where id = ${r.id}`;
  await rootSql()`update users set password_hash = ${await hashPassword(pw)}, must_change_password = false, failed_logins = 0, locked_until = null where id = ${r.user_id}`;
  await rootSql()`delete from sessions where user_id = ${r.user_id}`;
  return { ok: "Password changed. You can sign in now." };
}
