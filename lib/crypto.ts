import { createHash, randomBytes } from "crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const VERIFY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Printed verification code, e.g. "K7P2Q-9XMRT" (~50 bits). */
export function verifyCode() {
  const b = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += VERIFY_ALPHABET[b[i] % VERIFY_ALPHABET.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
/** Short fingerprint of a document's content, printed and shown on the verify page so they can be compared. */
export function fingerprint(refNo: string, version: number, data: unknown) {
  return sha256(`${refNo}|${version}|${JSON.stringify(data)}`).slice(0, 16).toUpperCase().replace(/(.{4})(?!$)/g, "$1 ");
}
export function shortCode(len = 7) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
