"use client";
import { useState } from "react";
import { Users, User, Trash2 } from "lucide-react";
import { saveAccess, saveVisibility, type AccessEntry } from "@/app/actions/forms";
import { Picker, type PickOption } from "../picker";
import { useAutosave, SaveLine } from "./autosave";
import type { BuilderData } from "./builder";

export function AccessTab({ formId, initialVisibility, initial, users, groups }: { formId: string; initialVisibility: string; initial: AccessEntry[]; users: BuilderData["users"]; groups: BuilderData["groups"] }) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [entries, setEntries] = useState<AccessEntry[]>(initial);
  const status = useAutosave({ visibility, entries }, async (v) => {
    await saveVisibility(formId, v.visibility);
    const r = await saveAccess(formId, v.entries);
    return r.removed.length ? `Removed from approval levels because they lost Review access: ${r.removed.join(", ")}.` : undefined;
  });
  const key = (e: AccessEntry) => (e.userId ? `u:${e.userId}` : `g:${e.groupId}`);
  const options: PickOption[] = [
    ...groups.map((g) => ({ key: `g:${g.id}`, label: g.name, sub: `Group · ${g.members} members`, kind: "group" as const })),
    ...users.map((u) => ({ key: `u:${u.id}`, label: u.name, sub: [u.username, u.department].filter(Boolean).join(" · "), kind: "user" as const })),
  ];
  const nameOf = (e: AccessEntry) => e.userId ? users.find((u) => u.id === e.userId)?.name : groups.find((g) => g.id === e.groupId)?.name;

  return (
    <div className="max-w-3xl space-y-5">
      <SaveLine status={status} />
      <div className="card p-4">
        <label className="label" htmlFor="vis">Who can open and submit this form?</label>
        <select id="vis" className="input max-w-md" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="public">Public — anyone with the link or QR code, no login</option>
          <option value="all_users">All users — any signed-in user of this property</option>
          <option value="assigned">Assigned users only — the people and groups below</option>
        </select>
        <p className="help">People with Review access below can always see all submissions and be chosen as approvers, whatever the visibility.</p>
      </div>
      <div className="card p-4">
        <p className="label">Give access to people or groups</p>
        <Picker options={options} selected={entries.map(key)} onChange={(keys) => {
          const added = keys.filter((k) => !entries.some((e) => key(e) === k));
          const kept = entries.filter((e) => keys.includes(key(e)));
          setEntries([...kept, ...added.map((k) => (k.startsWith("u:") ? { userId: k.slice(2), access: "general" as const } : { groupId: k.slice(2), access: "general" as const }))]);
        }} />
        <div className="mt-4 divide-y divide-ink-line rounded-lg border border-ink-line">
          {entries.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-mute">Nobody added yet.</p>}
          {entries.map((e, i) => (
            <div key={key(e)} className="flex flex-wrap items-center gap-3 px-3 py-2">
              {e.groupId ? <Users className="h-4 w-4 text-brand-600" /> : <User className="h-4 w-4 text-ink-mute" />}
              <span className="flex-1 text-sm font-medium">{nameOf(e) ?? "Unknown"}{e.groupId && <span className="ml-1 text-xs text-ink-mute">(group)</span>}</span>
              <select className="input w-auto py-1.5" value={e.access} aria-label={`Access for ${nameOf(e)}`} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, access: ev.target.value as "general" | "review" } : x)))}>
                <option value="general">General — submit, see own</option>
                <option value="review">Review — see all, can approve</option>
              </select>
              <button className="p-1 text-ink-mute hover:text-red-600" onClick={() => setEntries(entries.filter((_, j) => j !== i))} aria-label={`Remove ${nameOf(e)}`}><Trash2 className="h-4 w-4" /></button>
            </div>))}
        </div>
      </div>
    </div>
  );
}
