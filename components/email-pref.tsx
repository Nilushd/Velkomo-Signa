"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { setEmailApprovals } from "@/app/actions/prefs";

export function EmailPref({ initial, email }: { initial: boolean; email: string | null }) {
  const [on, setOn] = useState(initial && !!email);
  const [saved, setSaved] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-ink-line p-3">
      <div>
        <p className="text-sm font-semibold">Send me approval requests by e-mail</p>
        <p className="text-xs text-ink-mute">
          {email ? <>With one-click Approve / Reject buttons, to <b>{email}</b>. Turned off, requests still appear in My Approvals, on the Dashboard and as app notifications.</>
            : <>You have no e-mail address — ask your admin to add one. Until then requests reach you in the app.</>}
        </p>
        {saved && <p className="mt-1 text-xs text-emerald-700" aria-live="polite">{saved}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Send me approval requests by e-mail" disabled={!email}
        onClick={() => { const v = !on; setOn(v); start(async () => { await setEmailApprovals(v); setSaved(v ? "Saved — approval e-mails are on." : "Saved — app only, no approval e-mails."); }); }}
        className={clsx("relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-brand-600" : "bg-ink-line")}>
        <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
