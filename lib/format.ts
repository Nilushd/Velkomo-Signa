import type { Field, FileRef } from "./types";

export function isFileRef(v: unknown): v is FileRef {
  return !!v && typeof v === "object" && "fileId" in (v as object);
}

/** File field values are one FileRef or (multiple) an array of them. */
export function fileRefs(v: unknown): FileRef[] {
  if (Array.isArray(v)) return v.filter(isFileRef);
  return isFileRef(v) ? [v] : [];
}

export function formatValue(field: Pick<Field, "type">, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (field.type === "signature") return v ? "Signed" : "";
  if (field.type === "file") return fileRefs(v).map((f) => f.name).join(", ");
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

/** Dates are shown in the hotel's own time zone (pass it); falls back to NEXT_PUBLIC_TIMEZONE, then UTC. */
export function fmtDate(d: Date | string | null | undefined, withTime = true, tz?: string | null) {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  // NEXT_PUBLIC_TIMEZONE (e.g. Asia/Colombo) keeps server-rendered pages and PDFs in the hotel's local time
  const timeZone = tz || process.env.NEXT_PUBLIC_TIMEZONE || "UTC";
  return x.toLocaleString("en-GB", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }
    : { day: "2-digit", month: "short", year: "numeric", timeZone });
}
