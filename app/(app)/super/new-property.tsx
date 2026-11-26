"use client";
import { useActionState } from "react";
import { createProperty } from "@/app/actions/property";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function NewProperty() {
  const [state, run] = useActionState(createProperty, undefined);
  return (
    <form action={run} className="card max-w-3xl space-y-4 p-5">
      <h2 className="font-semibold">New property and its first Admin</h2>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="code">Property code</label><input id="code" name="code" className="input uppercase" placeholder="HTL03" required /></div>
        <div><label className="label" htmlFor="name">Property name</label><input id="name" name="name" className="input" required /></div>
        <div><label className="label" htmlFor="an">Admin full name</label><input id="an" name="adminName" className="input" required /></div>
        <div><label className="label" htmlFor="au">Admin username</label><input id="au" name="adminUsername" className="input" defaultValue="admin" required /></div>
        <div><label className="label" htmlFor="ae">Admin e-mail (optional)</label><input id="ae" name="adminEmail" type="email" className="input" /></div>
        <div><label className="label" htmlFor="ap">Temporary password</label><input id="ap" name="adminPassword" className="input font-mono" required minLength={8} /></div>
      </div>
      <SubmitButton>Create property</SubmitButton>
    </form>
  );
}
