"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

const KEY = "signa.propertyCode";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { const c = localStorage.getItem(KEY); if (c) setCode(c); } catch {}
  }, []);
  function onSubmit() {
    try { if (remember) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch {}
  }
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="property">Property code</label>
        <input id="property" name="property" className="input uppercase" autoCapitalize="characters" autoComplete="organization" required
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. HTL01" />
      </div>
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoCapitalize="none" autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type={show ? "text" : "password"} className="input" autoComplete="current-password" required />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 text-ink-soft"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
        <label className="flex items-center gap-2 text-ink-soft"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember property code</label>
      </div>
      <SubmitButton className="btn-primary w-full py-2.5" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link></p>
    </form>
  );
}
