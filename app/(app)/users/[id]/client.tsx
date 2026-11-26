"use client";
import { useActionState, useState, useTransition } from "react";
import { setUserFormAccess, setUserGroups, resetPassword } from "@/app/actions/users";
import { StatusBadge, Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function UserAccessTable({ userId, forms }: { userId: string; forms: { id: string; title: string; status: string; visibility: string; access: string | null; via_group: string | null }[] }) {
  const [vals, setVals] = useState(Object.fromEntries(forms.map((f) => [f.id, f.access ?? "none"])));
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (forms.length === 0) return <p className="text-sm text-ink-mute">No forms yet.</p>;
  return (
    <>
      {note && <div className="mb-3"><Alert kind="warn">{note}</Alert></div>}
      <div className="overflow-x-auto rounded-lg border border-ink-line">
        <table className="table">
          <thead><tr><th>Form</th><th>Status</th><th>Access</th><th>Through groups</th></tr></thead>
          <tbody>{forms.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.title}{f.visibility !== "assigned" && <p className="text-xs font-normal text-ink-mute">{f.visibility === "public" ? "Public form" : "Open to all users"}</p>}</td>
              <td><StatusBadge status={f.status} /></td>
              <td><select className="input w-auto py-1.5" disabled={pending} value={vals[f.id]} onChange={(e) => {
                const v = e.target.value as "none" | "general" | "review";
                setVals({ ...vals, [f.id]: v });
                start(async () => { const r = await setUserFormAccess(userId, f.id, v); setNote(r.removed.length ? `Removed from approval levels of “${f.title}”: ${r.removed.join(", ")}` : null); });
              }}><option value="none">No access</option><option value="general">General access</option><option value="review">Review access</option></select></td>
              <td className="text-xs text-ink-mute">{f.via_group ?? "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </>
  );
}

export function UserGroups({ userId, groups }: { userId: string; groups: { id: string; name: string; member: boolean }[] }) {
  const [sel, setSel] = useState(groups.filter((g) => g.member).map((g) => g.id));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  if (groups.length === 0) return <p className="text-sm text-ink-mute">No groups yet. Create them under Users &amp; Groups → Groups.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{groups.map((g) => (
        <label key={g.id} className={`badge cursor-pointer px-3 py-1.5 text-sm ring-1 ${sel.includes(g.id) ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-ink-soft ring-ink-line"}`}>
          <input type="checkbox" className="sr-only" checked={sel.includes(g.id)} onChange={(e) => { setSaved(false); setSel(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id)); }} />{g.name}</label>))}</div>
      <button className="btn-secondary" disabled={pending} onClick={() => start(async () => { await setUserGroups(userId, sel); setSaved(true); })}>{saved ? "Saved" : "Save groups"}</button>
    </div>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, run] = useActionState(resetPassword.bind(null, userId), undefined);
  return (
    <form action={run} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <input name="password" className="input font-mono" placeholder="New temporary password" required minLength={8} aria-label="New temporary password" />
      <SubmitButton className="btn-secondary">Reset password</SubmitButton>
    </form>
  );
}
