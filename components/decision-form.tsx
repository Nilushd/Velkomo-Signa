"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { Alert } from "./ui";

type Res = { ok: true; status: string } | { ok: false; error: string };

export function DecisionForm({ initial, action }: { initial: "approved" | "rejected" | null; action: (d: "approved" | "rejected", c: string) => Promise<Res> }) {
  const [decision, setDecision] = useState(initial);
  const [comment, setComment] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (res?.ok) return <Alert kind="success">{decision === "approved" ? "Approved" : "Rejected"}. {res.status === "approved" ? "The request is now fully approved." : res.status === "rejected" ? "The requester has been told and can edit and resubmit." : "It has moved to the next level."}</Alert>;
  return (
    <div className="space-y-3">
      {res && !res.ok && <Alert kind="error">{res.error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDecision("approved")} className={clsx("btn border-2 py-3", decision === "approved" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-ink-line bg-white")}><Check className="h-5 w-5" /> Approve</button>
        <button type="button" onClick={() => setDecision("rejected")} className={clsx("btn border-2 py-3", decision === "rejected" ? "border-red-600 bg-red-50 text-red-800" : "border-ink-line bg-white")}><X className="h-5 w-5" /> Reject</button>
      </div>
      <div>
        <label className="label" htmlFor="cm">Comment {decision === "rejected" ? <span className="text-red-600">(required)</span> : <span className="text-ink-mute">(optional)</span>}</label>
        <textarea id="cm" rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={decision === "rejected" ? "Tell the requester what to change" : ""} />
      </div>
      <button className={clsx("w-full py-3", decision === "rejected" ? "btn-danger" : "btn-success")} disabled={!decision || pending || (decision === "rejected" && !comment.trim())}
        onClick={() => start(async () => { const r = await action(decision!, comment); setRes(r); if (r.ok) router.refresh(); })}>
        {pending ? "Saving…" : decision === "rejected" ? "Confirm rejection" : decision === "approved" ? "Confirm approval" : "Choose approve or reject"}
      </button>
    </div>
  );
}
