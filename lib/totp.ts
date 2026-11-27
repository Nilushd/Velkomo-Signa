/** Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30 s) — what authenticator apps use. */
import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from "crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

export function codeAt(secret: string, step: number, digits = 6) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, "0");
}

export const stepNow = (t = Date.now()) => Math.floor(t / 1000 / 30);

/** Returns the matching time step (±1 step for clock drift), or null. Steps at or before `lastStep` are refused (no reuse). */
export function verifyCode(secret: string, code: string, lastStep: number | null, t = Date.now()): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = stepNow(t);
  for (const s of [now, now - 1, now + 1]) {
    if (lastStep !== null && s <= lastStep) continue;
    const want = codeAt(secret, s);
    if (timingSafeEqual(Buffer.from(want), Buffer.from(c))) return s;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer = "Velkomo Signa") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---- secrets at rest: AES-256-GCM with a key from AUTH_SECRET
function key() {
  const s = process.env.AUTH_SECRET || process.env.DATABASE_URL || "dev-only-secret";
  return createHash("sha256").update(`velkomo-signa-totp:${s}`).digest();
}
export function sealSecret(plain: string) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function openSecret(sealed: string) {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1") throw new Error("unknown secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

/** 8 backup codes like "K7P2-9XMR", shown once; only their hashes are stored. */
export function newRecoveryCodes() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => { const b = randomBytes(8); let s = ""; for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return `${s.slice(0, 4)}-${s.slice(4)}`; });
}
export const hashRecovery = (c: string) => createHash("sha256").update(c.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
