"use server";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin, asUser } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { newSecret, otpauthUrl, sealSecret, openSecret, verifyCode, newRecoveryCodes, hashRecovery } from "@/lib/totp";

/** Step 1 of turning on two-factor: a new secret (kept pending) and its QR code for the authenticator app. */
export async function startTwoFactor() {
  const u = await requireUser();
  const secret = newSecret();
  await rootSql()`update users set totp_pending_secret = ${sealSecret(secret)} where id = ${u.id}`;
  const account = `${u.username}@${u.property_code}`;
  const qr = await QRCode.toDataURL(otpauthUrl(secret, account), { margin: 1, width: 240, color: { dark: "#0F172A", light: "#FFFFFF" } });
  return { qr, secret: secret.replace(/(.{4})/g, "$1 ").trim(), account };
}

/** Step 2: the first code from the app proves it's set up; two-factor is on and 8 backup codes are returned once. */
export async function confirmTwoFactor(code: string) {
  const u = await requireUser();
  const [r] = await rootSql()<{ p: string | null }[]>`select totp_pending_secret as p from users where id = ${u.id}`;
  if (!r?.p) return { error: "Start again — the setup expired." };
  const secret = openSecret(r.p);
  const step = verifyCode(secret, code, null);
  if (step === null) return { error: "That code doesn't match. Check the time on your phone is automatic and try the newest code." };
  const codes = newRecoveryCodes();
  await rootSql()`update users set totp_secret = ${r.p}, totp_pending_secret = null, totp_enabled_at = now(), totp_last_step = ${step},
    recovery_codes = ${codes.map(hashRecovery)} where id = ${u.id}`;
  revalidatePath("/settings");
  return { ok: true as const, codes };
}

async function checkCode(userId: string, code: string): Promise<boolean> {
  const [u] = await rootSql()<{ s: string | null; last: string | null; rc: string[] | null }[]>`
    select totp_secret as s, totp_last_step as last, recovery_codes as rc from users where id = ${userId}`;
  if (!u?.s) return false;
  const step = verifyCode(openSecret(u.s), code, u.last === null ? null : Number(u.last));
  if (step !== null) { await rootSql()`update users set totp_last_step = ${step} where id = ${userId}`; return true; }
  const h = hashRecovery(code);
  if ((u.rc ?? []).includes(h)) { await rootSql()`update users set recovery_codes = ${(u.rc ?? []).filter((x) => x !== h)} where id = ${userId}`; return true; }
  return false;
}

/** Turn off — needs a current code (or a backup code), so a borrowed signed-in phone can't do it. */
export async function disableTwoFactor(code: string) {
  const u = await requireUser();
  if (!(await checkCode(u.id, code))) return { error: "That code isn't right." };
  await rootSql()`update users set totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null where id = ${u.id}`;
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function newBackupCodes(code: string) {
  const u = await requireUser();
  if (!(await checkCode(u.id, code))) return { error: "That code isn't right." };
  const codes = newRecoveryCodes();
  await rootSql()`update users set recovery_codes = ${codes.map(hashRecovery)} where id = ${u.id}`;
  return { ok: true as const, codes };
}

/** Admin: lost phone — switch two-factor off so the person can sign in with their password and set it up again. */
export async function adminResetTwoFactor(userId: string) {
  const admin = await requireAdmin();
  await asUser(admin, (tx) => tx`update users set totp_secret = null, totp_pending_secret = null, totp_enabled_at = null, totp_last_step = null, recovery_codes = null where id = ${userId}`);
  await rootSql()`delete from sessions where user_id = ${userId}`;
  revalidatePath(`/users/${userId}`);
  return { ok: true as const };
}
