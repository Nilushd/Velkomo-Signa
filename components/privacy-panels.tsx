"use client";
import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { savePrivacy, requestPrivacy, resolvePrivacyRequest, anonymiseUser } from "@/app/actions/privacy";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

/** Admin: privacy contact, notice, retention, consent. */
export function PrivacySettingsForm({ p, standardPreview }: { p: { contactName: string | null; contactEmail: string | null; notice: string | null; retention: number | null; consentAll: boolean; version: number }; standardPreview: string }) {
  const [state, run] = useActionState(savePrivacy, undefined);
  const [custom, setCustom] = useState(!!p.notice);
  // controlled, so the values stay as saved (React resets uncontrolled fields after a form action)
  const [name, setName] = useState(p.contactName ?? "");
  const [email, setEmail] = useState(p.contactEmail ?? "");
  const [ret, setRet] = useState(p.retention ? String(p.retention) : "");
  const [all, setAll] = useState(p.consentAll);
  const [text, setText] = useState(p.notice ?? standardPreview);
  return (
    // submitted by hand (not action=) so React doesn't reset the fields to their first values after saving
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="pc-name">Privacy contact <span className="font-normal text-ink-mute">(person or team)</span></label>
          <input id="pc-name" name="contactName" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Protection Officer" /></div>
        <div><label className="label" htmlFor="pc-email">Privacy contact e-mail</label>
          <input id="pc-email" name="contactEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="privacy@yourcompany.com" />
          <p className="help">Shown on every form&apos;s privacy notice. Privacy requests are e-mailed here too.</p></div>
      </div>
      <div>
        <label className="label" htmlFor="pc-ret">Keep requests for</label>
        <select id="pc-ret" name="retention" className="input sm:w-72" value={ret} onChange={(e) => setRet(e.target.value)}>
          <option value="">As long as we need them</option><option value="12">1 year</option><option value="24">2 years</option><option value="36">3 years</option>
          <option value="60">5 years</option><option value="84">7 years</option><option value="120">10 years</option>
        </select>
        <p className="help">Finished requests (approved, rejected or cancelled) older than this are deleted every night with their attachments. Check how long your country&apos;s employment, tax or audit rules require you to keep them.</p>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-ink-line p-3 text-sm">
        <input type="checkbox" name="consentAll" checked={all} onChange={(e) => setAll(e.target.checked)} className="mt-0.5" />
        <span><b>Ask staff to agree too</b><br /><span className="text-ink-mute">People filling in a public link always tick a consent box. Turn this on to ask signed-in staff as well.</span></span>
      </label>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="label mb-0">Privacy notice <span className="font-normal text-ink-mute">· version {p.version}</span></p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /> Write our own</label></div>
        {custom
          ? <textarea name="notice" rows={12} className="input mt-2 font-[inherit]" value={text} onChange={(e) => setText(e.target.value)} />
          : <><input type="hidden" name="notice" value="" /><div className="mt-2 max-h-56 overflow-auto whitespace-pre-line rounded-lg bg-ink-wash/70 p-3 text-sm text-ink-soft">{standardPreview}</div>
              <p className="help">The standard notice, filled in with your organisation&apos;s name, contact, storage location and retention period.</p></>}
      </div>
      <SubmitButton>Save privacy settings</SubmitButton>
    </form>
  );
}

type Req = { id: string; requester_name: string; kind: string; details: string | null; status: string; response: string | null; created: string; age_days: number };
const KIND: Record<string, string> = { access: "Copy of their data", correction: "Correction", erasure: "Deletion", other: "Other" };

export function PrivacyRequests({ rows }: { rows: Req[] }) {
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!rows.length) return <p className="text-sm text-ink-mute">No privacy requests yet.</p>;
  return (
    <ul className="divide-y divide-ink-line">
      {rows.map((r) => (
        <li key={r.id} className="py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <b>{r.requester_name}</b><span className="badge bg-ink-wash text-ink-soft">{KIND[r.kind] ?? r.kind}</span>
            <span className="text-xs text-ink-mute">{r.created}</span>
            {r.status === "open"
              ? <span className={r.age_days >= 21 ? "badge bg-red-50 text-red-700" : "badge bg-amber-50 text-amber-800"}>Open · {r.age_days} day{r.age_days === 1 ? "" : "s"}</span>
              : <span className="badge bg-emerald-50 text-emerald-800">{r.status === "done" ? "Done" : "Declined"}</span>}
          </div>
          {r.details && <p className="mt-1 text-sm text-ink-soft">{r.details}</p>}
          {r.status === "open" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <input className="input flex-1 py-1.5 text-sm" placeholder="Reply to them (kept on record)" value={answer[r.id] ?? ""} onChange={(e) => setAnswer({ ...answer, [r.id]: e.target.value })} aria-label={`Reply to ${r.requester_name}`} />
              <button className="btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await resolvePrivacyRequest(r.id, "done", answer[r.id] ?? ""); router.refresh(); })}>Mark done</button>
              <button className="btn-secondary btn-sm" disabled={pending || !(answer[r.id] ?? "").trim()} onClick={() => start(async () => { await resolvePrivacyRequest(r.id, "declined", answer[r.id] ?? ""); router.refresh(); })}>Decline</button>
            </div>
          ) : r.response && <p className="mt-1 text-xs text-ink-mute">Reply: {r.response}</p>}
        </li>))}
    </ul>
  );
}

/** Everyone: download my data, ask for a correction/deletion, see my recent sign-ins. */
export function YourData({ signIns }: { signIns: { when: string; where: string; device: string; method: string }[] }) {
  const [state, run] = useActionState(requestPrivacy, undefined);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/my-data" className="btn-secondary"><Download className="h-4 w-4" /> Download a copy of my data</a>
        <a href="/privacy" className="text-sm text-brand-700 hover:underline">Read the privacy notice</a>
      </div>
      <form action={run} className="space-y-3 rounded-lg border border-ink-line p-3">
        <p className="text-sm font-semibold">Ask about your information</p>
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.ok && <Alert kind="success">{state.ok}</Alert>}
        <div className="flex flex-wrap gap-2">
          <select name="kind" className="input w-auto" defaultValue="correction" aria-label="What would you like?">
            <option value="correction">Correct something</option><option value="erasure">Delete my information</option><option value="access">Send me a full copy</option><option value="other">Something else</option>
          </select>
          <input name="details" className="input min-w-0 flex-1" placeholder="What should change?" aria-label="Details" />
          <SubmitButton className="btn-secondary">Send request</SubmitButton>
        </div>
        <p className="help">Goes to your organisation&apos;s privacy contact and admins, and is kept on record until answered.</p>
      </form>
      <div>
        <p className="text-sm font-semibold">Recent sign-ins</p>
        {signIns.length === 0 ? <p className="text-sm text-ink-mute">No sign-ins recorded yet.</p> : (
          <ul className="mt-2 divide-y divide-ink-line text-sm">{signIns.map((s, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-4 py-1.5"><span>{s.device}{s.method === "two-factor" && <ShieldCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-600" aria-label="with two-factor" />}</span>
              <span className="text-ink-mute">{s.when}{s.where ? ` · ${s.where}` : ""}</span></li>))}</ul>)}
        <p className="help">Something you don&apos;t recognise? Change your password and turn on two-factor sign-in.</p>
      </div>
    </div>
  );
}

/** Admin, on a user's page: erase the person's identity (keeping records), optionally with their requests. */
export function AnonymiseUser({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [also, setAlso] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card p-5 lg:col-span-2">
      <h2 className="font-semibold">Erase personal data</h2>
      <p className="mt-1 text-sm text-ink-mute">For a former employee or a deletion request: removes {name}&apos;s name, username, e-mail, sign-in history, notifications and access, and signs them out for good. Approval records stay, shown as “Former user”, so documents remain valid.</p>
      {!open ? <button className="btn-secondary mt-3" onClick={() => setOpen(true)}>Erase personal data…</button> : (
        <div className="mt-3 space-y-3">
          {err && <Alert kind="error">{err}</Alert>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} className="mt-0.5" />
            <span>Also delete every request they submitted, with attachments <span className="text-ink-mute">(only if you don&apos;t need to keep them by law)</span></span></label>
          <label className="label" htmlFor="anon-confirm">Type ERASE to confirm</label>
          <div className="flex flex-wrap gap-2">
            <input id="anon-confirm" className="input w-40 font-mono uppercase" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoComplete="off" />
            <button className="btn-danger" disabled={pending || typed !== "ERASE"} onClick={() => start(async () => { const r = await anonymiseUser(userId, also); if (r && "error" in r) setErr(r.error ?? "Couldn't erase."); })}>{pending ? "Erasing…" : "Erase now"}</button>
            <button className="btn-ghost" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
          </div>
        </div>)}
    </section>
  );
}
