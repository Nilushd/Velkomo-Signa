"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { createHotel } from "@/app/actions/platform";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { Credentials } from "../credentials";

function plus(months: number) {
  const d = new Date(); d.setMonth(d.getMonth() + months); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function NewHotelForm() {
  const [state, run] = useActionState(createHotel, undefined);
  const [ends, setEnds] = useState(plus(12));
  const [code, setCode] = useState("");
  if (state?.ok && state.id && state.password) {
    return (
      <div className="max-w-2xl space-y-4">
        <Alert kind="success">Hotel created.</Alert>
        <Credentials code={state.code ?? code} username={state.username ?? "admin"} password={state.password} />
        <div className="flex gap-2"><Link href={`/platform?edit=${state.id}`} className="btn-primary">Edit hotel</Link><Link href="/platform" className="btn-secondary">Back to Platform</Link></div>
      </div>);
  }
  return (
    <form action={run} className="max-w-3xl space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Hotel</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Hotel name</label><input id="name" name="name" className="input" required placeholder="e.g. Lagoon View Resort" /></div>
          <div><label className="label" htmlFor="code">Property code</label><input id="code" name="code" className="input font-mono uppercase" required placeholder="e.g. LVR01" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <p className="help">Staff type this when they sign in. Letters, numbers, - and _.</p></div>
        </div>
        <div>
          <label className="label" htmlFor="ends">Subscription end date</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="ends" name="ends" type="date" className="input w-48" value={ends} onChange={(e) => setEnds(e.target.value)} />
            {[[1, "1 month"], [3, "3 months"], [12, "1 year"]].map(([m, l]) => <button key={l} type="button" className="btn-secondary btn-sm" onClick={() => setEnds(plus(m as number))}>{l}</button>)}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEnds("")}>No end date</button>
          </div>
          <p className="help">The hotel can use the app up to and including this day. After it, nobody at the hotel can sign in and its public forms close — nothing is deleted.</p>
        </div>
        <div><label className="label" htmlFor="notes">Notes <span className="font-normal text-ink-mute">(only Super Admins see these)</span></label>
          <textarea id="notes" name="notes" rows={2} className="input" placeholder="Contact person, plan, invoice number…" /></div>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">First Admin account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="an">Full name</label><input id="an" name="adminName" className="input" required /></div>
          <div><label className="label" htmlFor="au">Username</label><input id="au" name="adminUsername" className="input" defaultValue="admin" required /></div>
          <div><label className="label" htmlFor="ae">E-mail <span className="font-normal text-ink-mute">(optional)</span></label><input id="ae" name="adminEmail" type="email" className="input" /></div>
          <div><label className="label" htmlFor="ap">Temporary password</label><input id="ap" name="adminPassword" className="input font-mono" placeholder="Leave empty to generate one" />
            <p className="help">They must change it at first sign-in.</p></div>
        </div>
      </section>
      <SubmitButton className="btn-primary" pendingText="Creating…">Create hotel</SubmitButton>
    </form>
  );
}
