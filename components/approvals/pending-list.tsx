"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { decideMany } from "@/app/actions/submit";
import { Alert } from "../ui";

export interface PendingRow { id: string; ref_no: string; title: string; form_id: string; submitter: string | null; level: number; step_name: string; created: string; for_name: string | null; summary: [string, string][] }

/** Pending approvals with tick boxes: approve or reject many at once (each is recorded individually). */
export function PendingList({ rows }: { rows: PendingRow[] }) {
  const router = useRouter();
  const forms = useMemo(() => [...new Map(rows.map((r) => [r.form_id, r.title])).entries()], [rows]);
  const [formFilter, setFormFilter] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<null | "approved" | "rejected">(null);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<{ kind: "success" | "warn" | "error"; text: string; details?: string[] } | null>(null);
  const [pending, start] = useTransition();
  const shown = rows.filter((r) => !formFilter || r.form_id === formFilter);
  const allShown = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const chosen = rows.filter((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function run() {
    if (!ask) return;
    const ids = chosen.map((r) => r.id);
    start(async () => {
      const r = await decideMany(ids, ask, comment);
      if ("error" in r && r.error) { setResult({ kind: "error", text: r.error }); return; }
      const verb = ask === "approved" ? "approved" : "rejected";
      setResult({ kind: r.skipped.length ? "warn" : "success", text: `${r.done} ${verb}${r.skipped.length ? ` · ${r.skipped.length} skipped` : ""}.`,
        details: r.skipped.map((s) => `${s.ref}: ${s.reason}`) });
      setAsk(null); setComment(""); setSel(new Set()); router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {result && <Alert kind={result.kind}>{result.text}{result.details?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{result.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" aria-label="Select all shown" checked={allShown}
          onChange={() => setSel((s) => { const n = new Set(s); if (allShown) shown.forEach((r) => n.delete(r.id)); else shown.slice(0, 100).forEach((r) => n.add(r.id)); return n; })} /> Select all{formFilter ? " shown" : ""}</label>
        {forms.length > 1 && (
          <select className="input w-auto py-1.5" value={formFilter} onChange={(e) => setFormFilter(e.target.value)} aria-label="Filter by form">
            <option value="">All forms ({rows.length})</option>
            {forms.map(([id, t]) => <option key={id} value={id}>{t} ({rows.filter((r) => r.form_id === id).length})</option>)}
          </select>)}
        <span className="ml-auto text-xs text-ink-mute">{shown.length} waiting</span>
      </div>

      <ul className="space-y-2">{shown.map((r) => (
        <li key={r.id} className={clsx("card flex items-start gap-3 p-4 transition", sel.has(r.id) ? "border-brand-400 bg-brand-50/40" : "hover:border-brand-300")}>
          <input type="checkbox" className="mt-1.5 h-4 w-4" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.ref_no}`} />
          <Link href={`/approvals/${r.id}`} className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}{r.for_name && <span className="badge ml-2 bg-amber-50 align-middle text-amber-900 ring-1 ring-amber-200">for {r.for_name}</span>}</p>
              <p className="text-sm text-ink-mute"><span className="font-mono">{r.ref_no}</span> · {r.submitter} · Level {r.level}: {r.step_name}</p>
              {r.summary.length > 0 && (
                <dl className="mt-2 grid gap-x-5 gap-y-0.5 text-xs sm:grid-cols-3">
                  {r.summary.map(([k, v]) => <div key={k} className="min-w-0 truncate"><dt className="inline text-ink-mute">{k}: </dt><dd className="inline text-ink">{v}</dd></div>)}
                </dl>)}
            </div>
            <span className="text-xs text-ink-mute">{r.created}</span>
          </Link>
        </li>))}</ul>

      {chosen.length > 0 && !ask && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-brand-900 px-4 py-3 text-white shadow-xl" role="region" aria-label="Selected approvals">
          <span className="mr-auto text-sm font-medium">{chosen.length} selected{chosen.length > 100 ? " (max 100 at a time)" : ""}</span>
          <button className="btn bg-[#047857] text-white hover:bg-[#065F46]" onClick={() => { setAsk("approved"); setResult(null); }}><Check className="h-4 w-4" /> Approve selected</button>
          <button className="btn bg-[#D92D20] text-white hover:bg-[#B42318]" onClick={() => { setAsk("rejected"); setResult(null); }}><X className="h-4 w-4" /> Reject selected</button>
          <button className="btn px-2 text-white/80 hover:text-white" onClick={() => setSel(new Set())} aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>)}

      {ask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Confirm bulk decision" onClick={() => !pending && setAsk(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{ask === "approved" ? "Approve" : "Reject"} {chosen.length} request{chosen.length > 1 ? "s" : ""}?</h2>
            <p className="mt-1 text-sm text-ink-mute">Each one is recorded separately in its history, with your name and the time. {ask === "rejected" ? "Requesters are told and can edit and resubmit." : "Each moves to its next level, or is fully approved."}</p>
            <ul className="mt-3 max-h-44 overflow-auto rounded-lg border border-ink-line text-sm">
              {chosen.slice(0, 100).map((r) => <li key={r.id} className="flex justify-between gap-3 border-b border-ink-line/70 px-3 py-1.5 last:border-0"><span className="font-mono">{r.ref_no}</span><span className="truncate text-ink-mute">{r.title} · {r.submitter}</span></li>)}
            </ul>
            <label className="label mt-4" htmlFor="bulk-comment">Comment {ask === "rejected" ? <span className="text-red-600">(required — sent to every requester)</span> : <span className="font-normal text-ink-mute">(optional — added to each)</span>}</label>
            <textarea id="bulk-comment" rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" disabled={pending} onClick={() => setAsk(null)}>Cancel</button>
              <button className={ask === "approved" ? "btn-success" : "btn-danger"} disabled={pending || (ask === "rejected" && !comment.trim())} onClick={run}>
                {pending ? "Working…" : `${ask === "approved" ? "Approve" : "Reject"} ${chosen.length}`}</button>
            </div>
          </div>
        </div>)}
    </div>
  );
}
