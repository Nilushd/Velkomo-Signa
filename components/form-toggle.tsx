"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { setStatus } from "@/app/actions/forms";

/** Enable / disable a published form. Disabled forms stop taking submissions and aren't charged. */
export function FormToggle({ formId, title, enabled }: { formId: string; title: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <button type="button" role="switch" aria-checked={on} aria-label={`${on ? "Disable" : "Enable"} ${title}`} disabled={pending}
        onClick={() => start(async () => {
          const next = !on; setOn(next); setErr(null);
          const r = await setStatus(formId, next ? "published" : "closed");
          if (r && "error" in r && r.error) { setOn(!next); const m = /Your plan allows (\d+)/.exec(r.error); setErr(m ? `Plan limit reached (${m[1]} form types) — disable another first.` : r.error); return; }
          router.refresh();
        })}
        className={clsx("inline-flex items-center gap-2 text-sm font-medium", pending && "opacity-60")}>
        <span className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-brand-600" : "bg-slate-300")}>
          <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
        </span>
        <span className={on ? "text-brand-800" : "text-ink-mute"}>{on ? "Enabled" : "Disabled"}</span>
      </button>
      {err && <p className="mt-1 max-w-[220px] text-xs text-red-600">{err}</p>}
    </div>
  );
}
