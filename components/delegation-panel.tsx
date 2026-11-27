"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, X } from "lucide-react";
import { createDelegation, cancelDelegation } from "@/app/actions/delegation";
import { Picker } from "./picker";
import { Alert } from "./ui";
import type { DelegationRow } from "@/lib/delegation";

interface Person { id: string; name: string; department: string | null }

/** "Out of office — forward my approvals": pick a colleague and the days you're away. */
export function DelegationPanel({ fromUserId, self, people, forwarding, covering }:
  { fromUserId: string; self: boolean; people: Person[]; forwarding: DelegationRow[]; covering: DelegationRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [to, setTo] = useState<string[]>([]);
  const [startsOn, setStart] = useState(today);
  const [endsOn, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const who = self ? "you" : "they";
  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {forwarding.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="flex-1">{d.active ? "Now forwarding" : "Will forward"} approvals to <b>{d.other}</b> from {d.starts_on} to {d.ends_on}{d.note ? ` — “${d.note}”` : ""}.</span>
          <button className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => {
            const r = await cancelDelegation(d.id);
            setMsg("error" in r && r.error ? { kind: "error", text: r.error } : { kind: "success", text: `Cancelled.${r.back ? ` ${r.back} waiting approval${r.back > 1 ? "s were" : " was"} handed back.` : ""}` });
            router.refresh();
          })}><X className="h-3.5 w-3.5" /> {d.active ? "End now" : "Cancel"}</button>
        </div>))}
      {covering.map((d) => (
        <div key={d.id} className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-900 ring-1 ring-brand-200">
          {self ? "You are" : "They are"} {d.active ? "covering" : "going to cover"} for <b>{d.other}</b> from {d.starts_on} to {d.ends_on}. Their approvals appear in {self ? "your" : "their"} My Approvals marked “for {d.other}”.
        </div>))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><p className="label">Who approves while {who}&apos;re away?</p>
          <Picker options={people.filter((p) => p.id !== fromUserId).map((p) => ({ key: p.id, label: p.name, sub: p.department ?? "", kind: "user" as const }))}
            selected={to} onChange={(k) => setTo(k.slice(-1))} placeholder="Search for a colleague…" /></div>
        <div><label className="label" htmlFor="d-from">First day away</label><input id="d-from" type="date" className="input" min={today} value={startsOn} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="label" htmlFor="d-to">Last day away</label><input id="d-to" type="date" className="input" min={startsOn || today} value={endsOn} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="d-note">Note <span className="font-normal text-ink-mute">(optional)</span></label>
          <input id="d-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual leave" /></div>
      </div>
      <button className="btn-primary" disabled={pending || !to.length || !startsOn || !endsOn} onClick={() => start(async () => {
        const r = await createDelegation({ fromUserId, toUserId: to[0], startsOn, endsOn, note });
        if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
        if ("ok" in r) setMsg({ kind: "success", text: r.startsNow
          ? `Done. Approvals now go to ${r.toName}.${r.moved ? ` ${r.moved} waiting approval${r.moved > 1 ? "s were" : " was"} forwarded.` : ""}`
          : `Saved. From ${startsOn}, approvals go to ${r.toName}.` });
        setTo([]); setEnd(""); setNote(""); router.refresh();
      })}><CalendarClock className="h-4 w-4" /> Forward approvals</button>
      <p className="help">New and waiting approvals go to the colleague, marked “for {self ? "you" : "this person"}”; they can approve or reject by e-mail or in the app. When it ends (or is cancelled), approvals come back automatically.</p>
    </div>
  );
}
