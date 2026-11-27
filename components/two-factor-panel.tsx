"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Copy, Download, KeyRound } from "lucide-react";
import { startTwoFactor, confirmTwoFactor, disableTwoFactor, newBackupCodes } from "@/app/actions/twofa";
import { Alert } from "./ui";

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Velkomo Signa backup codes — each works once\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-3 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-amber-900">Save your backup codes now — they won&apos;t be shown again.</p>
      <p className="text-sm text-amber-900">Use one if you lose your phone. Each code works once.</p>
      <ol className="grid grid-cols-2 gap-2 font-mono text-base sm:grid-cols-4">{codes.map((c) => <li key={c} className="rounded bg-white px-2 py-1 text-center ring-1 ring-amber-200">{c}</li>)}</ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(text)}><Copy className="h-3.5 w-3.5" /> Copy</button>
        <a className="btn-secondary btn-sm" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="velkomo-signa-backup-codes.txt"><Download className="h-3.5 w-3.5" /> Download</a>
        <button type="button" className="btn-primary btn-sm" onClick={onDone}>I&apos;ve saved them</button>
      </div>
    </div>
  );
}

/** Settings: turn two-factor sign-in on (QR → code → backup codes) or off (needs a code). */
export function TwoFactorPanel({ enabled, backupLeft }: { enabled: boolean; backupLeft: number | null }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string; account: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"off" | "codes" | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (codes) return <BackupCodes codes={codes} onDone={() => { setCodes(null); router.refresh(); }} />;

  if (!enabled) {
    if (!setup) return (
      <div className="space-y-3">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <p className="text-sm text-ink-soft">Add a second step to signing in: after your password, enter a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…). Someone who learns your password still can&apos;t get in.</p>
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => { setSetup(await startTwoFactor()); setMsg(null); })}><ShieldCheck className="h-4 w-4" /> Turn on two-factor</button>
      </div>);
    return (
      <div className="space-y-4">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <ol className="space-y-4 text-sm">
          <li><b>1.</b> Open your authenticator app and scan this QR code (or tap “enter a setup key” and type the key below).
            <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg ring-1 ring-ink-line" />
              <div className="text-xs text-ink-mute">Account: <span className="font-mono text-ink">{setup.account}</span><br />Setup key: <span className="break-all font-mono text-ink">{setup.secret}</span></div>
            </div></li>
          <li><b>2.</b> Enter the 6-digit code the app shows:
            <div className="mt-2 flex max-w-xs gap-2">
              <input className="input text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" aria-label="6-digit code" />
              <button className="btn-primary" disabled={pending || code.replace(/\s/g, "").length !== 6} onClick={() => start(async () => {
                const r = await confirmTwoFactor(code);
                if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
                if ("codes" in r && r.codes) { setCodes(r.codes); setSetup(null); setCode(""); setMsg({ kind: "success", text: "Two-factor sign-in is on." }); }
              })}>Turn on</button>
            </div></li>
        </ol>
        <button className="btn-ghost btn-sm" onClick={() => { setSetup(null); setCode(""); setMsg(null); }}>Cancel</button>
      </div>);
  }

  return (
    <div className="space-y-3">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <p className="flex items-center gap-2 text-sm"><span className="badge bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"><ShieldCheck className="h-3.5 w-3.5" /> On</span>
        You&apos;re asked for a code from your authenticator app each time you sign in.{backupLeft !== null && <span className="text-ink-mute"> · {backupLeft} backup code{backupLeft === 1 ? "" : "s"} left</span>}</p>
      {backupLeft !== null && backupLeft <= 2 && <Alert kind="error">You&apos;re running out of backup codes — make new ones.</Alert>}
      {!mode ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => { setMode("codes"); setMsg(null); }}><KeyRound className="h-4 w-4" /> New backup codes</button>
          <button className="btn border border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => { setMode("off"); setMsg(null); }}><ShieldOff className="h-4 w-4" /> Turn off two-factor</button>
        </div>
      ) : (
        <div className="flex max-w-md flex-wrap items-center gap-2">
          <input className="input w-40 text-center font-mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" aria-label="Current code or backup code" autoFocus />
          <button className={mode === "off" ? "btn-danger" : "btn-primary"} disabled={pending || code.trim().length < 6} onClick={() => start(async () => {
            const r = mode === "off" ? await disableTwoFactor(code) : await newBackupCodes(code);
            if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
            setCode(""); setMode(null);
            if ("codes" in r && r.codes) setCodes(r.codes as string[]);
            else { setMsg({ kind: "success", text: "Two-factor sign-in is off." }); router.refresh(); }
          })}>{mode === "off" ? "Turn off" : "Make new codes"}</button>
          <button className="btn-ghost btn-sm" onClick={() => { setMode(null); setCode(""); }}>Cancel</button>
          <p className="w-full text-xs text-ink-mute">Enter the current code from your app (or a backup code) to confirm.</p>
        </div>)}
    </div>
  );
}
