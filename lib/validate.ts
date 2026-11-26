import type { Field, FileRef } from "./types";
import { isFileRef } from "./format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{6,20}$/;

/** Server-side check of submitted answers against the form schema. Unknown keys are dropped. */
export function validateAnswers(schema: Field[], raw: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of schema) {
    if (f.type === "heading") continue;
    let v = raw[f.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false;
    if (empty) {
      if (f.required) errors[f.id] = "This field is required.";
      continue;
    }
    switch (f.type) {
      case "text": case "textarea":
        v = String(v).slice(0, f.type === "text" ? 500 : 10000); break;
      case "number": {
        const n = Number(v);
        if (!Number.isFinite(n)) { errors[f.id] = "Enter a number."; continue; }
        v = n; break;
      }
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { errors[f.id] = "Enter a valid date."; continue; }
        v = String(v); break;
      case "email":
        if (!EMAIL_RE.test(String(v).trim())) { errors[f.id] = "Enter a valid email address."; continue; }
        v = String(v).trim(); break;
      case "phone":
        if (!PHONE_RE.test(String(v).trim())) { errors[f.id] = "Enter a valid phone number."; continue; }
        v = String(v).trim(); break;
      case "select": case "radio":
        if (!(f.options ?? []).includes(String(v))) { errors[f.id] = "Choose one of the options."; continue; }
        v = String(v); break;
      case "checkbox": {
        if (!f.options || f.options.length === 0) { v = v === true || v === "true" || v === "on"; break; }
        const arr = (Array.isArray(v) ? v : [v]).map(String).filter((x) => f.options!.includes(x));
        if (arr.length === 0) { if (f.required) errors[f.id] = "This field is required."; continue; }
        v = arr; break;
      }
      case "file":
        if (!isFileRef(v)) { errors[f.id] = "Upload a file."; continue; }
        v = { fileId: String((v as FileRef).fileId), name: String((v as FileRef).name).slice(0, 200), size: Number((v as FileRef).size) || 0 };
        break;
      case "signature": {
        const s = String(v);
        if (!s.startsWith("data:image/png;base64,") || s.length > 400_000) { errors[f.id] = "Please sign again."; continue; }
        v = s; break;
      }
    }
    data[f.id] = v;
  }
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function fileIdsIn(schema: Field[], data: Record<string, unknown>): string[] {
  return schema.filter((f) => f.type === "file").map((f) => data[f.id]).filter(isFileRef).map((r) => r.fileId);
}
