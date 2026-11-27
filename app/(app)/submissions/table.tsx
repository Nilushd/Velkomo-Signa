"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Download, FileArchive, Printer, X } from "lucide-react";
import { StatusBadge } from "@/components/ui";

export interface Row { id: string; ref_no: string; title: string; status: string; current_level: number; created: string; submitter: string | null; version: number }
const MAX = 100;

/** Submissions table with tick boxes: download the chosen ones as one PDF, a ZIP of PDFs, or print them. */
export function SubmissionsTable({ rows }: { rows: Row[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel].slice(0, MAX).join(",");
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>
            <th className="w-10"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.slice(0, MAX).map((r) => r.id)))} /></th>
            <th>Ref no</th><th>Form</th><th>Date</th><th>Submitter</th><th>Status</th><th>Level</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className={clsx("hover:bg-ink-wash/60", sel.has(r.id) && "bg-brand-50/60")}>
              <td><input type="checkbox" aria-label={`Select ${r.ref_no}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td><Link href={`/submissions/${r.id}`} className="font-mono font-medium text-brand-700 hover:underline">{r.ref_no}</Link>{r.version > 1 && <span className="ml-1 text-xs text-ink-mute">v{r.version}</span>}</td>
              <td>{r.title}</td>
              <td className="whitespace-nowrap text-ink-mute">{r.created}</td>
              <td>{r.submitter}</td>
              <td><StatusBadge status={r.status} /></td>
              <td className="text-ink-mute">{r.status === "pending" ? r.current_level : "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
      {sel.size > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-white shadow-xl" role="region" aria-label="Selected submissions">
          <span className="mr-auto text-sm font-medium">{sel.size} selected{sel.size > MAX ? ` (first ${MAX} will be used)` : ""}</span>
          <a href={`/api/pdf?ids=${ids}`} className="btn bg-white text-brand-900 hover:bg-brand-50"><Download className="h-4 w-4" /> Download PDF</a>
          <a href={`/api/pdf?ids=${ids}&format=zip`} className="btn bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20"><FileArchive className="h-4 w-4" /> ZIP (one PDF each)</a>
          <a href={`/print/batch?ids=${ids}`} target="_blank" rel="noreferrer" className="btn bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20"><Printer className="h-4 w-4" /> Print</a>
          <button className="btn px-2 text-white/80 hover:text-white" onClick={() => setSel(new Set())} aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>)}
    </>
  );
}
