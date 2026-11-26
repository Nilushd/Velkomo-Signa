import type { Field, FieldType } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

function isDate(v: unknown) {
  if (v instanceof Date) return !isNaN(v.getTime());
  const s = String(v).trim();
  return /^\d{4}-\d{1,2}-\d{1,2}/.test(s) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(s);
}

/** Guess a field type from sample values: number, date, email, phone, dropdown (≤10 distinct values), else text. */
export function detectType(samples: unknown[]): { type: FieldType; options?: string[] } {
  const vals = samples.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (vals.length === 0) return { type: "text" };
  if (vals.every((v) => v instanceof Date || isDate(v))) return { type: "date" };
  if (vals.every((v) => typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v).trim().replace(/,/g, "")))) return { type: "number" };
  if (vals.every((v) => EMAIL.test(String(v).trim()))) return { type: "email" };
  if (vals.every((v) => PHONE.test(String(v).trim()) && String(v).replace(/\D/g, "").length >= 7)) return { type: "phone" };
  const distinct = [...new Set(vals.map((v) => String(v).trim()))];
  if (distinct.length <= 10 && vals.length >= 2 && distinct.length < vals.length) return { type: "select", options: distinct };
  if (vals.some((v) => String(v).length > 80)) return { type: "textarea" };
  return { type: "text" };
}

export function fieldsFromRows(rows: unknown[][]): Field[] {
  const header = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const body = rows.slice(1, 21);
  return header.map((label, i) => {
    const d = detectType(body.map((r) => r[i]));
    return { id: `f_${i + 1}_${Math.random().toString(36).slice(2, 6)}`, label: label || `Column ${i + 1}`, type: d.type, options: d.options, required: false };
  }).filter((f) => f.label);
}
