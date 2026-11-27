"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { twoFactorAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function TwoFactorForm({ next }: { next: string }) {
  const [state, run] = useActionState(twoFactorAction, undefined);
  const [backup, setBackup] = useState(false);
  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {!backup ? (
        <div>
          <label className="label" htmlFor="code">6-digit code</label>
          <input id="code" name="code" className="input text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}" maxLength={7} placeholder="••••••" required autoFocus />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="code">Backup code</label>
          <input id="code" name="code" className="input text-center font-mono text-xl uppercase tracking-widest" autoComplete="off" placeholder="XXXX-XXXX" required autoFocus />
          <p className="help">Each backup code works once.</p>
        </div>
      )}
      <SubmitButton className="btn-primary w-full py-2.5" pendingText="Checking…"><ShieldCheck className="h-4 w-4" /> Verify and sign in</SubmitButton>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-brand-700 hover:underline" onClick={() => setBackup(!backup)}>{backup ? "Use the app code instead" : "Use a backup code"}</button>
        <Link href="/login" className="text-ink-mute hover:underline">Cancel</Link>
      </div>
      <p className="text-xs text-ink-mute">Lost your phone and backup codes? Ask your admin to turn off two-factor for your account.</p>
    </form>
  );
}
