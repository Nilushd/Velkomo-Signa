import type { Field, FileRef } from "./types";

export function isFileRef(v: unknown): v is FileRef {
  return !!v && typeof v === "object" && "fileId" in (v as object);
}

export function formatValue(field: Pick<Field, "type">, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (field.type === "signature") return v ? "Signed" : "";
  if (field.type === "file") return isFileRef(v) ? v.name : "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** First few answers, for e-mails and lists. */
export function summaryRows(schema: Field[], data: Record<string, unknown>, max = 8): [string, string][] {
  return schema
    .filter((f) => f.type !== "heading")
    .map((f) => [f.label, formatValue(f, data[f.id])] as [string, string])
    .filter(([, v]) => v)
    .slice(0, max)
    .map(([k, v]) => [k, v.length > 140 ? v.slice(0, 137) + "…" : v]);
}

export function fmtDate(d: Date | string | null | undefined, withTime = true) {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString("en-GB", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}
