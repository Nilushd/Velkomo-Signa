import { describe, it, expect } from "vitest";
import { validateAnswers, fileIdsIn } from "@/lib/validate";
import { verifyCode, fingerprint } from "@/lib/crypto";
import { headerLogo } from "@/lib/types";
import type { Field } from "@/lib/types";

const f = (n: number) => ({ fileId: `00000000-0000-0000-0000-00000000000${n}`, name: `f${n}.pdf`, size: 1000 });

describe("attachments", () => {
  const multi: Field[] = [{ id: "a", type: "file", label: "Attachments", multiple: true, maxFiles: 2 }];
  it("accepts several files up to the limit", () => {
    const r = validateAnswers(multi, { a: [f(1), f(2)] });
    expect(r.ok).toBe(true);
    expect(r.data.a).toHaveLength(2);
    expect(fileIdsIn(multi, r.data)).toHaveLength(2);
  });
  it("rejects more files than allowed", () => {
    expect(validateAnswers(multi, { a: [f(1), f(2), f(3)] }).ok).toBe(false);
  });
  it("single file fields keep one file", () => {
    const single: Field[] = [{ id: "a", type: "file", label: "Doc", required: true }];
    expect(validateAnswers(single, {}).ok).toBe(false);
    expect(validateAnswers(single, { a: f(1) }).data.a).toEqual(f(1));
    expect(validateAnswers(single, { a: [f(1), f(2)] }).ok).toBe(false);
  });
});

describe("print & verify helpers", () => {
  it("verification codes look like XXXXX-XXXXX and differ", () => {
    const a = verifyCode(), b = verifyCode();
    expect(a).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(a).not.toBe(b);
  });
  it("fingerprint changes with content or version", () => {
    const x = fingerprint("REQ-2026-0001", 1, { a: 1 });
    expect(x).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){3}$/);
    expect(fingerprint("REQ-2026-0001", 1, { a: 2 })).not.toBe(x);
    expect(fingerprint("REQ-2026-0001", 2, { a: 1 })).not.toBe(x);
  });
  it("header logo: hotel, custom, none, and old forms", () => {
    expect(headerLogo({ logoSource: "property" }, "P")).toBe("P");
    expect(headerLogo({ logoSource: "custom", logoFileId: "C" }, "P")).toBe("C");
    expect(headerLogo({ logoSource: "none", logoFileId: "C" }, "P")).toBeNull();
    expect(headerLogo({ logoFileId: "C" }, "P")).toBe("C");
  });
});
