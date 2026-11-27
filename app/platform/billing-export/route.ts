import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-auth";
import { computeBilling } from "@/lib/billing";

/** CSV of the bill calculation (Platform only). */
export async function GET(req: Request) {
  if (!(await getPlatformAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const u = new URL(req.url);
  const ok = (s: string | null) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const from = ok(u.searchParams.get("from")) ? u.searchParams.get("from")! : new Date().toISOString().slice(0, 7);
  const to = ok(u.searchParams.get("to")) ? u.searchParams.get("to")! : from;
  const b = await computeBilling(from, to);
  const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Hotel", "Property code", "Contract no", "Billing cycle", "Period start", "Period end", "Months", "Forms billed", "Form-days", "Form-months", "Forms (days enabled)", "Rate per form per month",
    "Subtotal", "Discount", "Minimum", "Minimum applied", "Tax", "Total", "Currency", "Billing contact", "Billing e-mail"];
  const lines = b.rows.map((r) => [r.name, r.code, r.contract?.contract_no, r.contract?.cycle ?? "monthly", b.start, b.end, b.months, r.forms.length, r.formDays, r.billed.toFixed(2), r.forms.map((f) => `${f.title} (${f.days})`).join("; "),
    r.rate.toFixed(2), r.subtotal.toFixed(2), r.discount.toFixed(2), r.minimum.toFixed(2), r.minimumApplied ? "yes" : "no", r.tax.toFixed(2), r.total.toFixed(2), b.settings.currency,
    r.contract?.contact_name, r.contract?.contact_email].map(q).join(","));
  const csv = "﻿" + [head.join(","), ...lines].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="velkomo-signa-billing-${from}${to !== from ? `_${to}` : ""}.csv"` } });
}
