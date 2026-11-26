"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Undo2 } from "lucide-react";
import { FormRenderer } from "./form-renderer";
import { resubmitAsUser, resubmitByToken, withdrawRequest } from "@/app/actions/submit";
import type { Field, Theme } from "@/lib/types";

/** Edit-and-resubmit (pre-filled) and Withdraw, shown to the original requester of a rejected request. */
export function RequesterActions({ submissionId, token, uploadCode, title, schema, theme, data, comment }:
  { submissionId: string; token?: string; uploadCode: string; title: string; schema: Field[]; theme: Theme; data: Record<string, unknown>; comment?: string | null }) {
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (editing) {
    return (
      <div className="rounded-2xl p-2 sm:p-4" style={{ background: theme.background || "#F4F7FC" }}>
        <FormRenderer title={`Edit: ${title}`} schema={schema} theme={theme} initial={data} uploadCode={uploadCode} submitLabel="Resubmit"
          header={comment ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Reviewer comment: “{comment}”</p> : null}
          footer={<button type="button" className="btn-ghost mb-3 mr-2" onClick={() => setEditing(false)}>Cancel</button>}
          onSubmit={async (d) => {
            const r = token ? await resubmitByToken(token, d) : await resubmitAsUser(submissionId, d);
            if (r.ok) { setEditing(false); router.refresh(); return; }
            return { error: r.error, fieldErrors: r.fieldErrors };
          }} />
      </div>
    );
  }
  return (
    <div className="card border-red-200 bg-red-50/40 p-4">
      <p className="font-semibold text-red-900">This request was rejected</p>
      {comment && <p className="mt-1 text-sm text-red-800">“{comment}”</p>}
      <p className="mt-1 text-sm text-ink-soft">Edit your answers and resubmit — it starts again at level 1 with the same reference number. Or withdraw it.</p>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit and resubmit</button>
        <button className="btn-secondary" disabled={pending} onClick={() => { if (confirm("Withdraw this request?")) start(async () => {
          const r = await withdrawRequest(submissionId, token);
          if (!r.ok) setErr(r.error); else router.refresh();
        }); }}><Undo2 className="h-4 w-4" /> Withdraw</button>
      </div>
    </div>
  );
}
