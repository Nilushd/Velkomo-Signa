import { describe, it, expect } from "vitest";
import { codeAt, verifyCode, base32Encode, base32Decode, sealSecret, openSecret, newRecoveryCodes, hashRecovery, stepNow } from "@/lib/totp";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890")); // RFC 6238 test key (SHA-1)

describe("two-factor codes", () => {
  it("matches the RFC 6238 test vectors (last 6 digits)", () => {
    expect(codeAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(codeAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(codeAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
  });
  it("base32 round-trips", () => {
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
  });
  it("accepts the current code (±30 s) once, and refuses reuse", () => {
    const t = Date.now(); const s = stepNow(t);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, s), null, t)).toBe(s);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, s - 1), null, t)).toBe(s - 1);
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, s - 3), null, t)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeAt(RFC_SECRET, s), s, t)).toBeNull(); // already used
    expect(verifyCode(RFC_SECRET, "12345", null, t)).toBeNull();
  });
  it("encrypts secrets at rest", () => {
    const sealed = sealSecret(RFC_SECRET);
    expect(sealed).not.toContain(RFC_SECRET);
    expect(openSecret(sealed)).toBe(RFC_SECRET);
  });
  it("backup codes are random and compared by hash, ignoring case and dashes", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(8);
    expect(hashRecovery(codes[0].toLowerCase().replace("-", ""))).toBe(hashRecovery(codes[0]));
  });
});
