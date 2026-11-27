"use client";
import { useActionState } from "react";
import { platformChangePassword } from "@/app/actions/platform-auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function PlatformPasswordForm({ first = false }: { first?: boolean }) {
  const [state, run] = useActionState(platformChangePassword, undefined);
  return (
    <form action={run} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div><label className="label" htmlFor="current">{first ? "Temporary password" : "Current password"}</label><input id="current" name="current" type="password" className="input" required autoComplete="current-password" /></div>
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        <p className="help">At least 8 characters, with a letter and a number.</p></div>
      <div><label className="label" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" className="input" required autoComplete="new-password" /></div>
      <SubmitButton className={first ? "btn-primary w-full" : "btn-primary"}>Save password</SubmitButton>
    </form>
  );
}
