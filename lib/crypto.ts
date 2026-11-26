import { createHash, randomBytes } from "crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function shortCode(len = 7) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
