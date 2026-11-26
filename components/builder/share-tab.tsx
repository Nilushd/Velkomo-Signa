"use client";
import { useState, useTransition } from "react";
import { Copy, Download, Check } from "lucide-react";
import { saveSettings, deleteForm, duplicateForm, transferOwner } from "@/app/actions/forms";
import { Alert } from "../ui";
import type { BuilderData } from "./builder";

export function ShareTab({ data, status, onStatus, pending }: { data: BuilderData; status: string; onStatus: (s: "draft" | "published" | "closed") => void; pending: boolean }) {
  const [copied, setCopied] = useState(false);
  const [closesAt, setClosesAt] = useState(data.form.closesAt);
  const [max, setMax] = useState(data.form.maxSubmissions?.toString() ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [owner, setOwner] = useState(data.form.ownerId ?? "");
  const [busy, start] = useTransition();
  const qr = `/api/qr/${data.form.shortCode}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${data.form.title}: ${data.url}`)}`;
  return (
    <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="font-semibold">Link and QR code</h2>
        {status !== "published" && <div className="mt-3"><Alert kind="warn">The form is {status}. Publish it so people can use the link.</Alert></div>}
        <div className="mt-4 flex gap-2">
          <input readOnly value={data.url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
          <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${qr}?format=png`} alt="QR code" className="h-44 w-44 rounded-lg border border-ink-line" />
          <div className="flex flex-col gap-2">
            <a href={`${qr}?format=png&download=1`} className="btn-secondary"><Download className="h-4 w-4" /> PNG</a>
            <a href={`${qr}?format=svg&download=1`} className="btn-secondary"><Download className="h-4 w-4" /> SVG</a>
            <a href={wa} target="_blank" rel="noreferrer" className="btn-secondary">Share on WhatsApp</a>
          </div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Closing</h2>
          {msg && <Alert kind="success">{msg}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="ca">Close on</label><input id="ca" type="datetime-local" className="input" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
            <div><label className="label" htmlFor="mx">Close after N submissions</label><input id="mx" type="number" min={1} className="input" value={max} onChange={(e) => setMax(e.target.value)} placeholder="No limit" /></div>
          </div>
          <button className="btn-secondary" disabled={busy} onClick={() => start(async () => {
            await saveSettings(data.form.id, { closesAt: closesAt ? new Date(closesAt).toISOString() : null, maxSubmissions: max ? Number(max) : null });
            setMsg("Closing settings saved.");
          })}>Save closing settings</button>
          <p className="help">Visibility is set on the Access tab.</p>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Status</h2>
          <div className="flex flex-wrap gap-2">
            {status !== "published" && <button className="btn-primary" disabled={pending} onClick={() => onStatus("published")}>Publish</button>}
            {status === "published" && <button className="btn-secondary" disabled={pending} onClick={() => onStatus("closed")}>Close form</button>}
            {status !== "draft" && <button className="btn-secondary" disabled={pending} onClick={() => onStatus("draft")}>Back to draft</button>}
            <button className="btn-secondary" onClick={() => start(() => duplicateForm(data.form.id))}>Duplicate</button>
            {data.submissionCount === 0 && <button className="btn-danger" onClick={() => { if (confirm("Delete this form? This can't be undone.")) start(() => deleteForm(data.form.id)); }}>Delete</button>}
          </div>
          {data.isAdmin && (
            <div className="pt-2"><label className="label" htmlFor="own">Form owner</label>
              <div className="flex gap-2"><select id="own" className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">—</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                <button className="btn-secondary" disabled={!owner || busy} onClick={() => start(async () => { await transferOwner(data.form.id, owner); setMsg("Owner changed."); })}>Change</button></div></div>)}
        </div>
      </div>
    </div>
  );
}
