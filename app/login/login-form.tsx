"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

const KEY = "signa.propertyCode";

/** The property code is saved on this device after the first successful sign-in; "Change" lets them type another. */
export function LoginForm({ next, saved }: { next: string; saved: { code: string; name: string } | null }) {
  const [state, action] = useActionState(loginAction, undefined);
  const [code, setCode] = useState(saved?.code ?? "");
  const [editing, setEditing] = useState(!saved);
  const [show, setShow] = useState(false);
  const [user, setUser] = useState(""); // kept after a wrong password (the form resets uncontrolled fields)
  useEffect(() => {
    if (saved) return;
    try { const c = localStorage.getItem(KEY); if (c) setCode(c); } catch {} // older devices that saved it in the browser
  }, [saved]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {editing ? (
        <div>
          <label className="label" htmlFor="property">Property code</label>
          <input id="property" name="property" className="input uppercase" autoCapitalize="characters" autoComplete="organization" required autoFocus={!!saved}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. HTL01" />
          {saved ? <p className="help">Saved on this device after you sign in. <button type="button" className="text-brand-700 hover:underline" onClick={() => { setCode(saved.code); setEditing(false); }}>Keep {saved.code}</button></p>
            : <p className="help">Saved on this device after you sign in, so you won&apos;t need to type it again.</p>}
        </div>
      ) : (
        <div>
          <p className="label">Property</p>
          <input type="hidden" name="property" value={code} />
          <div className="flex items-center gap-3 rounded-lg border border-ink-line bg-ink-wash/60 px-3 py-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-brand-600" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{saved?.name}</p><p className="font-mono text-xs text-ink-mute">{code}</p></div>
            <button type="button" id="change-property" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => { setCode(""); setEditing(true); }}>Change</button>
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoCapitalize="none" autoComplete="username" required autoFocus={!editing} value={user} onChange={(e) => setUser(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type={show ? "text" : "password"} className="input" autoComplete="current-password" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
      <SubmitButton className="btn-primary w-full py-2.5" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link><span className="mx-2 text-ink-line">|</span><Link href="/privacy" className="text-ink-mute hover:underline">Privacy</Link></p>
    </form>
  );
}
