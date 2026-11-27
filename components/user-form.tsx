"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "./submit-button";
import { Alert, StatusBadge } from "./ui";
import { ACCESS_LEVELS, AccessLegend, type Level } from "./access-levels";
import type { FormState } from "@/app/actions/auth";

interface U { username: string; name: string; email: string | null; department: string | null }
interface F { id: string; title: string; status: string }

/** User details. On "Add user" (no `user`) it also has the permissions: Admin, Form designer, and access per form. */
export function UserForm({ action, user, withPassword, forms, group }: { action: (s: FormState, fd: FormData) => Promise<FormState>; user?: U; withPassword?: boolean; forms?: F[];
  group?: { name: string; hotels: { id: string; code: string; name: string }[] } | null }) {
  const [state, run] = useActionState(action, undefined);
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [all, setAll] = useState<Level | "">("");
  return (
    <form action={run} className="space-y-5">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" className="input" defaultValue={user?.name} required /></div>
        <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" className="input" defaultValue={user?.username} autoCapitalize="none" required /></div>
        <div><label className="label" htmlFor="email">E-mail <span className="font-normal text-ink-mute">(optional)</span></label><input id="email" name="email" type="email" className="input" defaultValue={user?.email ?? ""} />
          <p className="help">Needed only for e-mail approvals and password resets.</p></div>
        <div><label className="label" htmlFor="department">Department</label><input id="department" name="department" className="input" defaultValue={user?.department ?? ""} /></div>
        {withPassword && <div><label className="label" htmlFor="password">Temporary password</label><input id="password" name="password" className="input font-mono" required minLength={8} />
          <p className="help">They must change it at first sign-in.</p></div>}
      </div>

      {forms && (
        <section className="space-y-4 rounded-xl border border-ink-line p-4">
          <h2 className="font-semibold">Permissions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-ink-line p-3 text-sm"><input type="checkbox" name="can_build_forms" className="mt-0.5" />
              <span><b>Form designer</b><br /><span className="text-ink-mute">Create and edit forms — builder, Form Studio and AI design.</span></span></label>
            <label className="flex items-start gap-3 rounded-lg border border-ink-line p-3 text-sm"><input type="checkbox" name="is_admin" className="mt-0.5" />
              <span><b>Admin of this property</b><br /><span className="text-ink-mute">Manage users and see every form and submission.</span></span></label>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-soft">Form access</p>
              {forms.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-ink-mute">Set every form to
                  <select className="input w-auto py-1 text-xs" value={all} onChange={(e) => { const v = e.target.value as Level; setAll(v); if (v) setLevels(Object.fromEntries(forms.map((f) => [f.id, v]))); }}>
                    <option value="">—</option>{ACCESS_LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}</select></label>)}
            </div>
            <AccessLegend />
            {forms.length === 0 ? <p className="mt-3 text-sm text-ink-mute">No forms yet.</p> : (
              <div className="mt-3 divide-y divide-ink-line rounded-lg border border-ink-line">
                {forms.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm font-medium">{f.title}</span>
                    <StatusBadge status={f.status} />
                    <select name={`access_${f.id}`} className="input w-40 py-1.5" value={levels[f.id] ?? "none"} aria-label={`Access to ${f.title}`}
                      onChange={(e) => setLevels({ ...levels, [f.id]: e.target.value as Level })}>
                      {ACCESS_LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}</select>
                  </div>))}
              </div>)}
          </div>
        </section>)}
      {group && group.hotels.length > 0 && (
        <section className="space-y-3 rounded-xl border border-ink-line p-4">
          <div><h2 className="font-semibold">Other hotels in {group.name}</h2>
            <p className="text-sm text-ink-mute">Tick the hotels this person may also work in. They switch hotels from the menu; each hotel&apos;s admin decides their role and form access there.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.hotels.map((h) => (
              <label key={h.id} className="flex items-center gap-3 rounded-lg border border-ink-line p-3 text-sm">
                <input type="checkbox" name={`hotel_${h.id}`} /> <span><b>{h.name}</b> <span className="font-mono text-xs text-ink-mute">{h.code}</span></span></label>))}
          </div>
        </section>)}
      <SubmitButton>{user ? "Save details" : "Create user"}</SubmitButton>
    </form>
  );
}
