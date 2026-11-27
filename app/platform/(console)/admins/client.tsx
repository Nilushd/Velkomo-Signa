"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UserPlus, Lock } from "lucide-react";
import { addPlatformAdmin, resetPlatformAdmin, setPlatformAdminActive } from "@/app/actions/platform-auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { Credentials } from "../credentials";

type Row = { id: string; username: string; name: string; email: string | null; active: boolean; must_change_password: boolean; totp: boolean; locked: boolean; last_seen: string | null };

export function AdminsClient({ meId, rows }: { meId: string; rows: Row[] }) {
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [state, run] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = await addPlatformAdmin(prev, fd);
    if (r.ok && r.password) { setCreds({ username: r.username!, password: r.password }); setAdding(false); router.refresh(); }
    return r;
  }, undefined);
  return (
    <div className="space-y-4">
      {creds && <Credentials code="PLATFORM" username={creds.username} password={creds.password} />}
      {err && <Alert kind="error">{err}</Alert>}
      <div className="card divide-y divide-ink-line">
        {rows.map((a) => (
          <div key={a.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${a.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.name} <span className="font-mono text-sm text-ink-mute">{a.username}</span>{a.id === meId && <span className="ml-2 text-xs text-ink-mute">(you)</span>}</p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">{a.email ?? "no e-mail"} · {a.last_seen ? `last sign-in ${a.last_seen}` : "never signed in"}
                {!a.active && <span className="badge bg-slate-100 text-slate-700">Deactivated</span>}
                {a.locked && <span className="badge bg-red-50 text-red-700"><Lock className="h-3 w-3" /> Locked</span>}
                {a.must_change_password && <span className="badge bg-amber-50 text-amber-800">Temporary password</span>}
                {a.totp && <span className="badge bg-emerald-50 text-emerald-800"><ShieldCheck className="h-3 w-3" /> 2FA</span>}</p>
            </div>
            {a.id !== meId && (
              <div className="flex gap-2">
                {a.active && <button className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => {
                  const off = a.totp ? confirm(`Also turn off two-factor for ${a.username}? (Choose OK if they lost their phone.)`) : false;
                  const r = await resetPlatformAdmin(a.id, off);
                  if ("error" in r && r.error) { setErr(r.error); return; }
                  if ("password" in r && r.password) { setCreds({ username: r.username, password: r.password }); setErr(null); router.refresh(); }
                })}><KeyRound className="h-4 w-4" /> Reset password</button>}
                <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => {
                  const r = await setPlatformAdminActive(a.id, !a.active);
                  if ("error" in r && r.error) setErr(r.error); else router.refresh();
                })}>{a.active ? "Deactivate" : "Reactivate"}</button>
              </div>)}
          </div>))}
      </div>
      {!adding ? <button className="btn-primary" onClick={() => { setAdding(true); setCreds(null); }}><UserPlus className="h-4 w-4" /> Add Super Admin</button> : (
        <form action={run} className="card max-w-2xl space-y-3 p-5">
          <h2 className="font-semibold">New Super Admin</h2>
          {state && "error" in state && state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="pa-name">Full name</label><input id="pa-name" name="name" className="input" required /></div>
            <div><label className="label" htmlFor="pa-user">Username</label><input id="pa-user" name="username" className="input" required /></div>
            <div><label className="label" htmlFor="pa-email">E-mail <span className="font-normal text-ink-mute">(optional)</span></label><input id="pa-email" name="email" type="email" className="input" /></div>
          </div>
          <p className="help">A temporary password is made and shown once. They choose their own at first sign-in.</p>
          <div className="flex gap-2"><SubmitButton className="btn-primary" pendingText="Adding…">Add Super Admin</SubmitButton><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>)}
    </div>
  );
}
