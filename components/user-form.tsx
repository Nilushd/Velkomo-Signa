"use client";
import { useActionState } from "react";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import type { FormState } from "@/app/actions/auth";

interface U { username: string; name: string; email: string | null; department: string | null; is_admin: boolean; can_build_forms: boolean }

export function UserForm({ action, user, withPassword }: { action: (s: FormState, fd: FormData) => Promise<FormState>; user?: U; withPassword?: boolean }) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-4">
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
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="can_build_forms" defaultChecked={user?.can_build_forms} /> Can build forms (form owner)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_admin" defaultChecked={user?.is_admin} /> Admin of this property</label>
      </div>
      <SubmitButton>{user ? "Save changes" : "Create user"}</SubmitButton>
    </form>
  );
}
