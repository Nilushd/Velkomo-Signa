import clsx from "clsx";
import { CheckCircle2, XCircle, Clock, MinusCircle, Send, RotateCcw, Undo2, Flag } from "lucide-react";
import type { Detail } from "@/lib/submission-view";
import type { Field } from "@/lib/types";
import { formatValue, fmtDate, fileRefs } from "@/lib/format";
import { StatusBadge } from "./ui";
import { AttachmentList } from "./attachments";
import { FileArchive } from "lucide-react";

export function Answers({ schema, data, fileQuery = "", submissionId }: { schema: Field[]; data: Record<string, unknown>; fileQuery?: string; submissionId?: string }) {
  const allFiles = schema.filter((f) => f.type === "file").flatMap((f) => fileRefs(data[f.id]));
  return (
    <>
    {submissionId && allFiles.length > 1 && (
      <div className="mb-1 flex justify-end">
        <a href={`/api/files/zip?submission=${submissionId}${fileQuery ? `&${fileQuery.slice(1)}` : ""}`} className="btn-secondary btn-sm"><FileArchive className="h-4 w-4" /> Download all attachments ({allFiles.length})</a>
      </div>)}
    <dl className="divide-y divide-ink-line">
      {schema.map((f) => {
        if (f.type === "heading") return <h3 key={f.id} className="pb-1 pt-4 text-sm font-semibold text-brand-700">{f.label}</h3>;
        const v = data[f.id];
        let out: React.ReactNode = formatValue(f, v) || <span className="text-ink-mute">—</span>;
        if (f.type === "file" && fileRefs(v).length) out = <AttachmentList files={fileRefs(v)} query={fileQuery} />;
        // eslint-disable-next-line @next/next/no-img-element
        if (f.type === "signature" && typeof v === "string" && v) out = <img src={v} alt="Signature" className="h-20 rounded border border-ink-line bg-white" />;
        return (
          <div key={f.id} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(140px,35%)_1fr] sm:gap-4">
            <dt className="text-sm text-ink-mute">{f.label}</dt>
            <dd className="whitespace-pre-line break-words text-sm text-ink">{out}</dd>
          </div>);
      })}
    </dl>
    </>
  );
}

/** Level-by-level progress for the current version. */
export function Progress({ d }: { d: Detail }) {
  const { sub, steps, approvals } = d;
  if (steps.length === 0) return <p className="text-sm text-ink-mute">No approval levels — accepted automatically.</p>;
  const cur = approvals.filter((a) => a.version === sub.version);
  return (
    <ol className="space-y-3">
      {steps.map((s) => {
        const at = cur.filter((a) => a.level === s.level);
        const decided = at.find((a) => a.decision === "approved" || a.decision === "rejected");
        const state = decided ? decided.decision : sub.status === "pending" && sub.current_level === s.level ? "current" : sub.status === "approved" ? "approved" : "waiting";
        const Icon = state === "approved" ? CheckCircle2 : state === "rejected" ? XCircle : state === "current" ? Clock : MinusCircle;
        return (
          <li key={s.level} className="flex gap-3">
            <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", { approved: "text-emerald-600", rejected: "text-red-600", current: "text-amber-500", waiting: "text-ink-line" }[state])} />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Level {s.level}: {s.name}</p>
              {decided ? <p className="text-ink-mute">{decided.decision === "approved" ? "Approved" : "Rejected"} by {decided.approver} · {fmtDate(decided.decided_at, true, d.tz)}</p>
                : at.length ? <p className="text-ink-mute">{state === "current" ? "Waiting for " : ""}{at.map((a) => a.approver).join(", ")}</p>
                : <p className="text-ink-mute">Not started</p>}
              {decided?.comment && <p className={clsx("mt-1 rounded-md px-2 py-1", decided.decision === "rejected" ? "bg-red-50 text-red-800" : "bg-ink-wash text-ink-soft")}>“{decided.comment}”</p>}
            </div>
          </li>);
      })}
    </ol>
  );
}

const ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  submitted: { label: "Submitted", icon: Send, cls: "text-brand-600" },
  resubmitted: { label: "Edited and resubmitted", icon: RotateCcw, cls: "text-brand-600" },
  level_started: { label: "Sent for approval", icon: Clock, cls: "text-amber-500" },
  level_approved: { label: "Approved level", icon: CheckCircle2, cls: "text-emerald-600" },
  level_rejected: { label: "Rejected", icon: XCircle, cls: "text-red-600" },
  level_skipped: { label: "Level skipped", icon: MinusCircle, cls: "text-ink-mute" },
  approved: { label: "Request approved", icon: Flag, cls: "text-emerald-600" },
  withdrawn: { label: "Cancelled", icon: Undo2, cls: "text-ink-mute" },
  forwarded: { label: "Forwarded", icon: Send, cls: "text-amber-500" },
};

export function History({ d }: { d: Detail }) {
  return (
    <ol className="relative space-y-4 border-l border-ink-line pl-5">
      {d.audit.map((e, i) => {
        const a = ACTIONS[e.action] ?? { label: e.action, icon: Clock, cls: "text-ink-mute" };
        const det = e.detail as { level?: number; step?: string; comment?: string; approvers?: string[]; version?: number; via?: string; to?: string; note?: string };
        return (
          <li key={i} className="relative text-sm">
            <a.icon className={clsx("absolute -left-[29px] top-0.5 h-4 w-4 bg-white", a.cls)} />
            <p><span className="font-medium">{a.label}</span>{det.step ? ` — ${det.step}` : ""}{det.version && det.version > 1 && e.action !== "level_started" ? ` (v${det.version})` : ""}</p>
            <p className="text-xs text-ink-mute">{e.actor}{det.via === "email" ? " · by e-mail" : ""} · {fmtDate(e.created_at, true, d.tz)}</p>
            {det.approvers && <p className="text-xs text-ink-mute">Approvers: {det.approvers.join(", ")}</p>}
            {det.to && <p className="text-xs text-ink-mute">To {det.to}{det.note ? ` — ${det.note}` : ""}</p>}
            {det.comment && <p className="mt-1 text-ink-soft">“{det.comment}”</p>}
          </li>);
      })}
    </ol>
  );
}

export function SummaryCard({ d }: { d: Detail }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{d.sub.ref_no}</span><StatusBadge status={d.sub.status} />
        {d.sub.version > 1 && <span className="badge bg-ink-wash text-ink-soft">Version {d.sub.version}</span>}</div>
      <p className="mt-2 text-sm text-ink-mute">{d.form.title} · by {d.sub.submitter} · {fmtDate(d.sub.created_at, true, d.tz)}</p>
      <p className="mt-1 text-xs text-ink-mute">Verification code <span className="font-mono font-semibold text-ink-soft">{d.sub.verify_code}</span></p>
    </div>
  );
}

export function OldVersions({ d, fileQuery }: { d: Detail; fileQuery?: string }) {
  if (!d.versions.length) return null;
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Earlier versions ({d.versions.length})</summary>
      {d.versions.map((v) => (
        <div key={v.version} className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Version {v.version} · {fmtDate(v.created_at, true, d.tz)}</p>
          <Answers schema={d.form.schema} data={v.data} fileQuery={fileQuery} /></div>))}
    </details>
  );
}
