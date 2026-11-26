"use client";
import { useActionState, useState, useTransition } from "react";
import { createGroup, saveGroupMembers, deleteGroup, renameGroup } from "@/app/actions/users";
import { Picker } from "@/components/picker";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

function Group({ g, users }: { g: { id: string; name: string; members: string[] }; users: { id: string; name: string; department: string | null }[] }) {
  const [sel, setSel] = useState(g.members);
  const [name, setName] = useState(g.name);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(true);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <input className="input flex-1 font-semibold" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} aria-label="Group name" />
        <button className="btn-ghost btn-sm text-red-600" onClick={() => { if (confirm(`Delete group “${g.name}”? Its form access and approver entries are removed too.`)) start(() => deleteGroup(g.id)); }}>Delete</button>
      </div>
      <Picker options={users.map((u) => ({ key: u.id, label: u.name, sub: u.department ?? "", kind: "user" }))} selected={sel} onChange={(s) => { setSel(s); setSaved(false); }} placeholder="Add members…" />
      <div className="mt-3 flex items-center gap-2">
        <button className="btn-secondary btn-sm" disabled={pending || saved} onClick={() => start(async () => { if (name !== g.name) await renameGroup(g.id, name); await saveGroupMembers(g.id, sel); setSaved(true); })}>{saved ? "Saved" : "Save"}</button>
        <span className="text-xs text-ink-mute">{sel.length} members</span>
      </div>
    </div>
  );
}

export function GroupsClient({ groups, users }: { groups: { id: string; name: string; members: string[] }[]; users: { id: string; name: string; department: string | null }[] }) {
  const [state, run] = useActionState(createGroup, undefined);
  return (
    <div className="space-y-4">
      <form action={run} className="card flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor="gname">New group</label><input id="gname" name="name" className="input" placeholder="e.g. Finance, HR, Front Office" required /></div>
        <SubmitButton>Create group</SubmitButton>
        {state?.error && <div className="w-full"><Alert kind="error">{state.error}</Alert></div>}
      </form>
      <div className="grid gap-4 lg:grid-cols-2">{groups.map((g) => <Group key={g.id + g.members.join()} g={g} users={users} />)}</div>
    </div>
  );
}
