import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, asUser } from "@/lib/auth";
import { formAccess, canReview } from "@/lib/access";
import { formatValue } from "@/lib/format";
import type { FormRow, SubmissionRow } from "@/lib/types";

/** Excel / CSV export of a form's submissions — Review access and admins only. */
/** "2026-11-27 14:05" in the hotel's time zone. */
function localStamp(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const u = await getSession();
  if (!u || u.must_change_password) return new NextResponse("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || null;
  const result = await asUser(u, async (tx) => {
    const [form] = await tx<FormRow[]>`select * from forms where id = ${formId}`;
    if (!form || !canReview(await formAccess(tx, u, form))) return null;
    const subs = await tx<(SubmissionRow & { submitter: string | null })[]>`
      select s.*, coalesce(us.name, s.submitter_name, s.submitter_email) as submitter from submissions s left join users us on us.id = s.submitter_id
      where s.form_id = ${formId} and (${status}::text is null or s.status = ${status}) order by s.created_at`;
    return { form, subs };
  });
  if (!result) return new NextResponse("Not allowed", { status: 403 });
  const fields = result.form.schema.filter((f) => f.type !== "heading" && f.type !== "signature");
  const rows = result.subs.map((s) => {
    const r: Record<string, unknown> = { "Reference": s.ref_no, "Submitted": localStamp(s.created_at, u.time_zone), "Submitter": s.submitter ?? "",
      "Status": s.status, "Level": s.current_level, "Version": s.version };
    for (const f of fields) r[f.label] = formatValue(f, s.data[f.id]);
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const base = result.form.title.replace(/[^\w-]+/g, "-").toLowerCase() + "-submissions";
  if (url.searchParams.get("format") === "csv") {
    return new NextResponse("﻿" + XLSX.utils.sheet_to_csv(ws), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Submissions");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
}
