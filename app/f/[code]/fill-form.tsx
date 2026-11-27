"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FormRenderer } from "@/components/form-renderer";
import { submitForm } from "@/app/actions/submit";
import type { Field, Theme } from "@/lib/types";

declare global { interface Window { hcaptcha?: { render: (el: HTMLElement, o: { sitekey: string }) => string; getResponse: (id?: string) => string; reset: (id?: string) => void } } }

export function FillForm({ code, title, description, schema, theme, signedInAs, captchaSiteKey, initial, propertyName, propertyLogo, consent }:
  { consent: boolean; code: string; title: string; description: string; schema: Field[]; theme: Theme; signedInAs: string | null; captchaSiteKey: string | null; initial?: Record<string, unknown>; propertyName: string; propertyLogo: string | null }) {
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<{ refNo: string; status: string; statusToken?: string; id?: string } | null>(null);
  const cap = useRef<HTMLDivElement>(null);
  const capId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!captchaSiteKey) return;
    const render = () => { if (cap.current && window.hcaptcha && capId.current === undefined) capId.current = window.hcaptcha.render(cap.current, { sitekey: captchaSiteKey }); };
    if (window.hcaptcha) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://js.hcaptcha.com/1/api.js?render=explicit"; s.async = true; s.onload = () => setTimeout(render, 50);
    document.head.appendChild(s);
  }, [captchaSiteKey]);

  if (done) {
    const primary = theme.primary || "#2563EB";
    return (
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-white text-center shadow-card ring-1 ring-black/5">
        <div className="h-2" style={{ background: primary }} />
        <div className="p-8">
          <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: primary }} />
          <h1 className="mt-3 text-2xl font-bold">{done.status === "approved" ? "Submitted and accepted" : "Submitted"}</h1>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{theme.thankYou || "Thank you! Your request has been received."}</p>
          <div className="mx-auto mt-6 w-fit rounded-xl bg-ink-wash px-6 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-mute">Your reference number</p>
            <p className="font-mono text-xl font-bold">{done.refNo}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {done.statusToken && <Link href={`/s/${done.statusToken}`} className="btn-secondary">Track status</Link>}
            {done.id && <Link href={`/requests/${done.id}`} className="btn-secondary">View in My Requests</Link>}
            <button className="btn-ghost" onClick={() => location.reload()}>Submit another</button>
          </div>
          {done.statusToken && <p className="mt-4 text-xs text-ink-mute">If you gave an e-mail address, we sent you a receipt with this link.</p>}
        </div>
      </div>
    );
  }
  return (
    <FormRenderer title={title} description={description} schema={schema} theme={theme} uploadCode={code} initial={initial} propertyName={propertyName} propertyLogo={propertyLogo}
      header={signedInAs ? <p className="mt-3 text-xs text-ink-mute">Signed in as {signedInAs}</p> : null}
      footer={<>
        {consent ? (
          <label className="mb-3 flex items-start gap-3 rounded-lg bg-ink-wash/70 p-3 text-sm text-ink-soft">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} name="privacy_consent" />
            <span>I agree that {propertyName} may use the information in this form, including any files I attach, to handle my request, as explained in its <a href={`/f/${code}/privacy`} target="_blank" rel="noopener" className="text-brand-700 underline">privacy notice</a>.</span>
          </label>
        ) : (
          <p className="mb-3 text-xs text-ink-mute">How {propertyName} uses this information: <a href={`/f/${code}/privacy`} target="_blank" rel="noopener" className="text-brand-700 underline">privacy notice</a>.</p>
        )}
        {captchaSiteKey ? <div ref={cap} className="mb-3" /> : null}
      </>}
      onSubmit={async (data) => {
        const token = captchaSiteKey && window.hcaptcha ? window.hcaptcha.getResponse(capId.current) : null;
        if (consent && !agreed) return { error: "Please tick the box to agree to the privacy notice before sending." };
        const r = await submitForm(code, data, token, consent ? agreed : undefined);
        if (r.ok) { setDone(r); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        if (captchaSiteKey) window.hcaptcha?.reset(capId.current);
        return { error: r.error, fieldErrors: r.fieldErrors };
      }} />
  );
}
