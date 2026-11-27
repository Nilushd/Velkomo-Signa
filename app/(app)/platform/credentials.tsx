"use client";
import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";

/** Shown once after creating an admin or resetting a password, ready to pass on to the hotel. */
export function Credentials({ code, username, password }: { code: string; username: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + "/login" : "/login";
  const text = `Velkomo Signa sign-in\n${url}\nProperty code: ${code}\nUsername: ${username}\nTemporary password: ${password}\n(You'll be asked to choose your own password.)`;
  return (
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><KeyRound className="h-4 w-4" /> Pass these on to the admin — the password is shown only now.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-amber-900/80">Property code</dt><dd className="font-mono font-semibold">{code}</dd>
        <dt className="text-amber-900/80">Username</dt><dd className="font-mono font-semibold">{username}</dd>
        <dt className="text-amber-900/80">Temporary password</dt><dd className="font-mono text-base font-semibold" data-testid="temp-password">{password}</dd>
      </dl>
      <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy sign-in details"}</button>
    </div>
  );
}
