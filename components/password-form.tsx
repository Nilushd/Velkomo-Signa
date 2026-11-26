"use client";
import { useActionState } from "react";
import Link from "next/link";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import type { FormState } from "@/app/actions/auth";

export function PasswordForm({ action, withCurrent, token }: { action: (s: FormState, fd: FormData) => Promise<FormState>; withCurrent?: boolean; token?: string }) {
  const [state, run] = useActionState(action, undefined);
  if (state?.ok) return <div className="space-y-4"><Alert kind="success">{state.ok}</Alert><Link href="/login" className="btn-primary w-full">Go to sign in</Link></div>;
  return (
    <form action={run} className="space-y-4">
      {token && <input type="hidden" name="token" value={token} />}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {withCurrent && <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" className="input" required autoComplete="current-password" /></div>}
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" className="input" required autoComplete="new-password" minLength={8} />
        <p className="help">At least 8 characters, with a letter and a number.</p></div>
      <div><label className="label" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" className="input" required autoComplete="new-password" /></div>
      <SubmitButton className="btn-primary w-full">Save password</SubmitButton>
    </form>
  );
}
