"use client";
import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import { setUserFormAccess, setUserAccessAllForms, setUserGroups, resetPassword, setRole } from "@/app/actions/users";
import { StatusBadge, Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ACCESS_LEVELS, type Level } from "@/components/access-levels";

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-brand-600" : "bg-ink-line")}>
      <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

/** Property-wide permissions: Form designer (builder + Form Studio + AI design) and Admin. */
export function RoleSwitches({ userId, isAdmin, designer, self }: { userId: string; isAdmin: boolean; designer: boolean; self: boolean }) {
  const [v, setV] = useState({ admin: isAdmin, designer });
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  function flip(role: "admin" | "designer", on: boolean) {
    setV((x) => ({ ...x, [role]: on }));
    start(async () => { const r = await setRole(userId, role, on); if ("error" in r && r.error) { setV((x) => ({ ...x, [role]: !on })); setMsg(r.error); } else setMsg("Saved."); });
  }
  const rows = [
    { role: "designer" as const, title: "Form designer", text: "Create and edit forms — form builder, Form Studio (from Excel/PDF/photo) and AI design.", on: v.designer || v.admin, disabled: v.admin },
    { role: "admin" as const, title: "Admin of this property", text: "Manage users and permissions; see every form and submission. Includes Form designer.", on: v.admin, disabled: self && v.admin },
  ];
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.role} className="flex items-start justify-between gap-4 rounded-lg border border-ink-line p-3">
            <div><p className="text-sm font-semibold">{r.title}</p><p className="text-xs text-ink-mute">{r.text}</p></div>
            <Switch label={r.title} on={r.on} disabled={r.disabled} onChange={(on) => flip(r.role, on)} />
          </div>))}
      </div>
      {msg && <p className="text-xs text-ink-mute" aria-live="polite">{msg}</p>}
    </div>
  );
}

export function UserAccessTable({ userId, forms }: { userId: string; forms: { id: string; title: string; status: string; visibility: string; access: string | null; via_group: string | null }[] }) {
  const [vals, setVals] = useState<Record<string, Level>>(Object.fromEntries(forms.map((f) => [f.id, (f.access ?? "none") as Level])));
  const [note, setNote] = useState<{ kind: "success" | "warn"; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (forms.length === 0) return <p className="text-sm text-ink-mute">No forms yet.</p>;
  const report = (removed: string[], what: string) => setNote(removed.length ? { kind: "warn", text: `${what} Removed from approval levels (no longer has Approval access): ${removed.join(", ")}.` } : { kind: "success", text: what });
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-ink-mute">
        Set every form to
        {ACCESS_LEVELS.map((l) => (
          <button key={l.v} className="btn-secondary btn-sm" disabled={pending} onClick={() => {
            if (!confirm(`Set ${l.label} on all ${forms.length} forms for this person?`)) return;
            setVals(Object.fromEntries(forms.map((f) => [f.id, l.v])));
            start(async () => { const r = await setUserAccessAllForms(userId, l.v); report(r.removed, `All forms set to ${l.label}.`); });
          }}>{l.label}</button>))}
      </div>
      {note && <Alert kind={note.kind}>{note.text}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-ink-line">
        <table className="table">
          <thead><tr><th>Form</th><th>Status</th><th>Access</th><th>Through groups</th></tr></thead>
          <tbody>{forms.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.title}{f.visibility !== "assigned" && <p className="text-xs font-normal text-ink-mute">{f.visibility === "public" ? "Public form — anyone can fill it in" : "Open to all users"}</p>}</td>
              <td><StatusBadge status={f.status} /></td>
              <td><select className={clsx("input w-40 py-1.5", vals[f.id] === "approve" && "border-brand-300 bg-brand-50", vals[f.id] === "none" && "text-ink-mute")} disabled={pending} value={vals[f.id]} aria-label={`Access to ${f.title}`}
                onChange={(e) => {
                  const v = e.target.value as Level;
                  setVals({ ...vals, [f.id]: v });
                  start(async () => { const r = await setUserFormAccess(userId, f.id, v); report(r.removed, `“${f.title}”: ${ACCESS_LEVELS.find((l) => l.v === v)!.label}.`); });
                }}>{ACCESS_LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}</select></td>
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
