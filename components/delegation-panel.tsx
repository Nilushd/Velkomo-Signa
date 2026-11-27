"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CalendarClock, X } from "lucide-react";
import { createDelegation, cancelDelegation, removeDelegationForm } from "@/app/actions/delegation";
import { Picker } from "./picker";
import { Alert } from "./ui";
import type { DelegationRow } from "@/lib/delegation";

interface Person { id: string; name: string; department: string | null }
interface FormOpt { id: string; title: string }

/** "Out of office — forward my approvals": a colleague, the days away, and all forms or only some. */
export function DelegationPanel({ fromUserId, self, people, forms, forwarding, covering }:
  { fromUserId: string; self: boolean; people: Person[]; forms: FormOpt[]; forwarding: DelegationRow[]; covering: DelegationRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [to, setTo] = useState<string[]>([]);
  const [startsOn, setStart] = useState(today);
  const [endsOn, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const who = self ? "you" : "they";
  const back = (n: number) => (n ? ` ${n} waiting approval${n > 1 ? "s were" : " was"} handed back.` : "");
  const formsLabel = (d: DelegationRow) => (d.forms.length ? "" : "all forms");

  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {forwarding.map((d) => (
        <div key={d.id} className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <div className="flex flex-wrap items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{d.active ? "Now forwarding" : "Will forward"} {formsLabel(d) ? <b>all forms</b> : "these forms"} to <b>{d.other}</b>, {d.starts_on} – {d.ends_on}{d.note ? ` · “${d.note}”` : ""}</p>
              {d.forms.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.forms.map((f) => (
                    <span key={f.id} className="badge bg-white py-1 pl-2.5 pr-1 text-amber-900 ring-1 ring-amber-300">{f.title}
                      <button className="rounded-full p-0.5 hover:bg-amber-100" disabled={pending} aria-label={`Stop forwarding ${f.title}`} title="Stop forwarding this form"
                        onClick={() => { if (!confirm(`Stop forwarding “${f.title}” to ${d.other}?`)) return; start(async () => {
                          const r = await removeDelegationForm(d.id, f.id);
                          setMsg("error" in r && r.error ? { kind: "error", text: r.error } : { kind: "success", text: `Stopped forwarding “${f.title}”.${"back" in r ? back(r.back ?? 0) : ""}${"cancelled" in r && r.cancelled ? " That was the last form, so the forwarding is cancelled." : ""}` });
                          router.refresh();
                        }); }}><X className="h-3 w-3" /></button>
                    </span>))}
                </div>)}
            </div>
            <button className="btn-secondary btn-sm" disabled={pending} onClick={() => { if (!confirm(`Cancel forwarding to ${d.other}? Waiting approvals come back to ${self ? "you" : "them"}.`)) return; start(async () => {
              const r = await cancelDelegation(d.id);
              setMsg("error" in r && r.error ? { kind: "error", text: r.error } : { kind: "success", text: `Forwarding to ${d.other} cancelled.${back("back" in r ? r.back ?? 0 : 0)}` });
              router.refresh();
            }); }}><X className="h-3.5 w-3.5" /> {d.active ? "End now" : "Cancel forwarding"}</button>
          </div>
        </div>))}

      {covering.map((d) => (
        <div key={d.id} className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-900 ring-1 ring-brand-200">
          {self ? "You are" : "They are"} {d.active ? "covering" : "going to cover"} for <b>{d.other}</b> ({d.forms.length ? d.forms.map((f) => f.title).join(", ") : "all forms"}), {d.starts_on} – {d.ends_on}.
        </div>))}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><p className="label">Who approves while {who}&apos;re away?</p>
          <Picker options={people.filter((p) => p.id !== fromUserId).map((p) => ({ key: p.id, label: p.name, sub: p.department ?? "", kind: "user" as const }))}
            selected={to} onChange={(k) => setTo(k.slice(-1))} placeholder="Search for a colleague…" /></div>
        <div><label className="label" htmlFor="d-from">First day away</label><input id="d-from" type="date" className="input" min={today} value={startsOn} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="label" htmlFor="d-to">Last day away</label><input id="d-to" type="date" className="input" min={startsOn || today} value={endsOn} onChange={(e) => setEnd(e.target.value)} /></div>

        <fieldset className="sm:col-span-2">
          <legend className="label">Which approvals?</legend>
          <div className="flex flex-wrap gap-2">
            {([["all", "All my approvals"], ["some", "Only selected forms"]] as const).map(([v, l]) => (
              <label key={v} className={clsx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", scope === v ? "border-brand-500 bg-brand-50 text-brand-900" : "border-ink-line")}>
                <input type="radio" name="d-scope" checked={scope === v} onChange={() => setScope(v)} /> {l}</label>))}
          </div>
          {scope === "some" && (forms.length === 0
            ? <p className="mt-2 text-sm text-ink-mute">{self ? "You aren't" : "They aren't"} an approver on any published form yet.</p>
            : <div className="mt-2 grid gap-1.5 rounded-lg border border-ink-line p-2 sm:grid-cols-2">
                {forms.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ink-wash">
                    <input type="checkbox" checked={picked.includes(f.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, f.id] : picked.filter((x) => x !== f.id))} /> {f.title}</label>))}
              </div>)}
        </fieldset>

        <div className="sm:col-span-2"><label className="label" htmlFor="d-note">Note <span className="font-normal text-ink-mute">(optional)</span></label>
          <input id="d-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual leave" /></div>
      </div>
      <button className="btn-primary" disabled={pending || !to.length || !startsOn || !endsOn || (scope === "some" && picked.length === 0)} onClick={() => start(async () => {
        const r = await createDelegation({ fromUserId, toUserId: to[0], startsOn, endsOn, note, formIds: scope === "some" ? picked : [] });
        if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
        const what = scope === "some" ? `${picked.length} form${picked.length > 1 ? "s" : ""}` : "approvals";
        if ("ok" in r) setMsg({ kind: "success", text: r.startsNow
          ? `Done. ${what[0].toUpperCase() + what.slice(1)} now ${what === "1 form" ? "goes" : "go"} to ${r.toName}.${r.moved ? ` ${r.moved} waiting approval${r.moved > 1 ? "s were" : " was"} forwarded.` : ""}`
          : `Saved. From ${startsOn}, ${what} ${what === "1 form" ? "goes" : "go"} to ${r.toName}.` });
        setTo([]); setEnd(""); setNote(""); setPicked([]); setScope("all"); router.refresh();
      })}><CalendarClock className="h-4 w-4" /> Forward approvals</button>
      <p className="help">New and waiting approvals go to the colleague, marked “for {self ? "you" : "this person"}”. You can forward different forms to different people. Cancel at any time — waiting approvals come straight back; it also ends by itself after the last day.</p>
    </div>
  );
}
