"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { saveApprovals, type AccessEntry, type StepInput } from "@/app/actions/forms";
import { Picker, type PickOption } from "../picker";
import { Alert } from "../ui";
import type { BuilderData } from "./builder";

export function ApprovalsTab({ formId, initial, users, groups, access }: { formId: string; initial: StepInput[]; users: BuilderData["users"]; groups: BuilderData["groups"]; access: AccessEntry[] }) {
  const [steps, setSteps] = useState<StepInput[]>(initial);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  // only users/groups with REVIEW access (as last saved on the Access tab)
  const reviewUsers = new Set(access.filter((a) => a.access === "review" && a.userId).map((a) => a.userId!));
  const reviewGroups = new Set(access.filter((a) => a.access === "review" && a.groupId).map((a) => a.groupId!));
  const options: PickOption[] = [
    ...groups.filter((g) => reviewGroups.has(g.id)).map((g) => ({ key: `g:${g.id}`, label: g.name, sub: "Group", kind: "group" as const })),
    ...users.filter((u) => reviewUsers.has(u.id)).map((u) => ({ key: `u:${u.id}`, label: u.name, sub: [u.department, u.email ? "" : "no e-mail → app only"].filter(Boolean).join(" · "), kind: "user" as const })),
  ];
  const keys = (s: StepInput) => s.approvers.map((a) => (a.userId ? `u:${a.userId}` : `g:${a.groupId}`));
  const upd = (i: number, p: Partial<StepInput>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => { const n = [...steps]; [n[i], n[i + d]] = [n[i + d], n[i]]; setSteps(n); };

  return (
    <div className="max-w-3xl space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <Alert kind="info">Requests go through these levels in order. When a level has several approvers, the <b>first to act decides</b> for that level. A rejection sends the request back to the requester. No levels = submissions are accepted automatically.</Alert>
      {options.length === 0 && <Alert kind="warn">Nobody has Review access yet. Give people Review access on the Access tab (and save) before choosing approvers.</Alert>}
      {steps.map((s, i) => (
        <div key={i} className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            <input className="input flex-1 font-medium" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Level name, e.g. Manager review" aria-label="Level name" />
            <button className="btn-ghost px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button className="btn-ghost px-2" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button className="btn-ghost px-2 hover:text-red-600" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Remove level"><Trash2 className="h-4 w-4" /></button>
          </div>
          <p className="label">Approvers</p>
          <Picker options={options} selected={keys(s)} emptyText="Only users and groups with Review access can be approvers"
            onChange={(ks) => upd(i, { approvers: ks.map((k) => (k.startsWith("u:") ? { userId: k.slice(2) } : { groupId: k.slice(2) })) })} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Notify by</label>
              <select className="input" value={s.channel} onChange={(e) => upd(i, { channel: e.target.value as StepInput["channel"] })}>
                <option value="both">E-mail and app</option><option value="email">E-mail</option><option value="app">App (inbox + push)</option></select></div>
            <div><label className="label">Reminder</label>
              <select className="input" value={s.reminderDays ?? ""} onChange={(e) => upd(i, { reminderDays: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No reminder</option>{[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>After {d} day{d > 1 ? "s" : ""}</option>)}</select></div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {steps.length < 5 && <button className="btn-secondary" onClick={() => setSteps([...steps, { name: `Level ${steps.length + 1}`, channel: "both", reminderDays: null, approvers: [] }])}><Plus className="h-4 w-4" /> Add level</button>}
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await saveApprovals(formId, steps);
          setMsg("error" in r && r.error ? { kind: "error", text: r.error } : { kind: "success", text: steps.length ? "Approval levels saved." : "Saved. Submissions will be accepted automatically." });
        })}>{pending ? "Saving…" : "Save approval levels"}</button>
      </div>
    </div>
  );
}
