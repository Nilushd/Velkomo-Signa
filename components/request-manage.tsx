"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Trash2 } from "lucide-react";
import { withdrawRequest, deleteRequestAction } from "@/app/actions/submit";
import { Alert } from "./ui";

/** Cancel (keep on record) or delete a request — before any approver acts, or after a rejection. */
export function RequestManage({ submissionId, refNo, token, rejected, asAdmin, afterDelete }:
  { submissionId: string; refNo: string; token?: string; rejected: boolean; asAdmin: boolean; afterDelete: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="card flex flex-wrap items-center gap-3 border-ink-line p-4">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{asAdmin ? "Admin: cancel or delete this request" : "Changed your mind?"}</p>
        <p className="text-ink-mute">{rejected ? "This request was rejected." : "No approver has acted on it yet."} <b>Cancel</b> keeps it on record as Cancelled; <b>Delete</b> removes it completely{rejected ? "" : " and takes it out of the approvers' inboxes"}.</p>
        {err && <div className="mt-2"><Alert kind="error">{err}</Alert></div>}
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={pending} onClick={() => { if (!confirm(`Cancel ${refNo}? It stays on record as Cancelled.`)) return; start(async () => {
          const r = await withdrawRequest(submissionId, token);
          if (!r.ok) setErr(r.error); else router.refresh();
        }); }}><Ban className="h-4 w-4" /> Cancel request</button>
        <button className="btn border border-red-200 bg-white text-red-700 hover:bg-red-50" disabled={pending} onClick={() => { if (!confirm(`Delete ${refNo} permanently? Its answers and attachments are removed. This can't be undone.`)) return; start(async () => {
          const r = await deleteRequestAction(submissionId, token);
          if (!r.ok) setErr(r.error); else router.push(`${afterDelete}${afterDelete.includes("?") ? "&" : "?"}deleted=${encodeURIComponent(refNo)}`);
        }); }}><Trash2 className="h-4 w-4" /> Delete request</button>
      </div>
    </div>
  );
}
