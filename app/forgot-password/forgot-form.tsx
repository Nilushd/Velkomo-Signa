"use client";
import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
export function ForgotForm() {
  const [state, run] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={run} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div><label className="label" htmlFor="property">Property code</label><input id="property" name="property" className="input uppercase" required /></div>
      <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" className="input" autoCapitalize="none" required /></div>
      <SubmitButton className="btn-primary w-full">Send reset link</SubmitButton>
      <p className="text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </form>
  );
}
