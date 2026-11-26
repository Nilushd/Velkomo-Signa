"use client";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { saveApprovals, type AccessEntry, type StepInput } from "@/app/actions/forms";
import { Picker, type PickOption } from "../picker";
import { Alert } from "../ui";
import { useAutosave, SaveLine } from "./autosave";
import type { BuilderData } from "./builder";

/** Options for choosing approvers: everyone; people without Review access get it when chosen. */
export function approverOptions(users: BuilderData["users"], groups: BuilderData["groups"], access: AccessEntry[]): PickOption[] {
  const rev = new Set(access.filter((a) => a.access === "review").map((a) => a.userId ?? a.groupId));
  return [
    ...groups.map((g) => ({ key: `g:${g.id}`, label: g.name, sub: `Group · ${g.members} members${rev.has(g.id) ? "" : " · will get Review access"}`, kind: "group" as const })),
    ...users.map((u) => ({ key: `u:${u.id}`, label: u.name, sub: [u.department, u.email ? "" : "no e-mail → app only", rev.has(u.id) ? "" : "will get Review access"].filter(Boolean).join(" · "), kind: "user" as const })),
  ];
}

export function stepProblem(steps: StepInput[]): string | null {
  const noName = steps.findIndex((s) => !s.name.trim());
  if (noName >= 0) return `level ${noName + 1} needs a name.`;
  const empty = steps.findIndex((s) => s.approvers.length === 0);
  return empty >= 0 ? `choose at least one approver for level ${empty + 1}.` : null;
}

export function LevelsEditor({ steps, setSteps, options }: { steps: StepInput[]; setSteps: (s: StepInput[]) => void; options: PickOption[] }) {
  const keys = (s: StepInput) => s.approvers.map((a) => (a.userId ? `u:${a.userId}` : `g:${a.groupId}`));
  const upd = (i: number, p: Partial<StepInput>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => { const n = [...steps]; [n[i], n[i + d]] = [n[i + d], n[i]]; setSteps(n); };
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            <input className="input flex-1 font-medium" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Level name, e.g. Manager review" aria-label="Level name" />
            <button className="btn-ghost px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button className="btn-ghost px-2" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button className="btn-ghost px-2 hover:text-red-600" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Remove level"><Trash2 className="h-4 w-4" /></button>
          </div>
          <p className="label">Approvers {s.approvers.length > 1 && <span className="font-normal text-ink-mute">— the first to act decides</span>}</p>
          <Picker options={options} selected={keys(s)} placeholder="Search people or groups…"
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
      {steps.length < 5 && <button className="btn-secondary" onClick={() => setSteps([...steps, { name: `Level ${steps.length + 1}`, channel: "both", reminderDays: null, approvers: [] }])}><Plus className="h-4 w-4" /> Add approval level</button>}
    </div>
  );
}

export function ApprovalsTab({ formId, initial, users, groups, access }: { formId: string; initial: StepInput[]; users: BuilderData["users"]; groups: BuilderData["groups"]; access: AccessEntry[] }) {
  const [steps, setSteps] = useState<StepInput[]>(initial);
  const status = useAutosave(steps, async (v) => {
    const r = await saveApprovals(formId, v);
    if ("error" in r && r.error) throw new Error(r.error);
    return "granted" in r && r.granted?.length ? `Review access given to ${r.granted.join(", ")}.` : undefined;
  }, stepProblem);
  return (
    <div className="max-w-3xl space-y-4">
      <SaveLine status={status} />
      <Alert kind="info">Requests go through these levels in order. With several approvers on a level, the <b>first to act decides</b>. A rejection sends the request back to the requester. No levels = submissions are accepted automatically.</Alert>
      <LevelsEditor steps={steps} setSteps={setSteps} options={approverOptions(users, groups, access)} />
    </div>
  );
}
