"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, CalendarClock, KeyRound, PauseCircle, PlayCircle, Trash2, UserPlus, ShieldCheck, Lock } from "lucide-react";
import { updateHotel, setSubscription, setHotelActive, setFormTypeLimit, resetAdminPassword, createAdmin, deleteHotel } from "@/app/actions/platform";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { Credentials } from "./credentials";

const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
function addMonths(from: string | null, months: number) {
  // extend from the current end date if it's still ahead, otherwise from today
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const base = from && new Date(from + "T00:00:00Z") >= today ? new Date(from + "T00:00:00Z") : new Date(today.getTime() - 86400000);
  const d = new Date(base); d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function SubscriptionPanel({ id, ends, daysLeft, active }: { id: string; ends: string | null; daysLeft: number | null; active: boolean }) {
  const [date, setDate] = useState(ends ?? "");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (v: string | null) => start(async () => {
    const r = await setSubscription(id, v);
    if (r && "error" in r && r.error) setMsg({ kind: "error", text: r.error });
    else { setMsg({ kind: "success", text: v ? `Subscription now ends on ${day(v)}.` : "Subscription has no end date." }); setDate(v ?? ""); router.refresh(); }
  });
  return (
    <section className="space-y-4" id="subscription">
      <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-brand-600" /><h2 className="font-semibold">Subscription</h2></div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {!active ? <Alert kind="warn">Suspended — nobody at this hotel can sign in until you resume it.</Alert>
        : daysLeft !== null && daysLeft < 0 ? <Alert kind="error">Expired on {day(ends!)}. Staff can&apos;t sign in and public forms are closed. Their data is kept — set a new end date to reopen.</Alert>
        : daysLeft !== null && daysLeft <= 30 ? <Alert kind="warn">Ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}. The hotel&apos;s admins see a reminder in the app.</Alert> : null}
      <div>
        <label className="label" htmlFor="ends">Last day of subscription</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="ends" type="date" className="input w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-primary" disabled={pending || !date || date === ends} onClick={() => save(date)}>Save date</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-mute">Extend by</span>
        {[[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "1 year"]].map(([m, l]) => (
          <button key={l} className="btn-secondary btn-sm" disabled={pending} onClick={() => save(addMonths(ends, m as number))}>+ {l}</button>))}
        {ends && <button className="btn-ghost btn-sm" disabled={pending} onClick={() => save(null)}>No end date</button>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {active
          ? <button className="btn-secondary btn-sm" disabled={pending} onClick={() => { if (confirm("Suspend this hotel? Everyone is signed out and can't sign in until you resume it.")) start(async () => { await setHotelActive(id, false); router.refresh(); }); }}><PauseCircle className="h-4 w-4" /> Suspend now</button>
          : <button className="btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await setHotelActive(id, true); router.refresh(); })}><PlayCircle className="h-4 w-4" /> Resume hotel</button>}
        <p className="flex-1 text-xs text-ink-mute">Suspending blocks access straight away (e.g. unpaid invoice) without changing the end date.</p>
      </div>
    </section>
  );
}

export function HotelDetails({ id, name, notes }: { id: string; name: string; notes: string }) {
  const [state, run] = useActionState(updateHotel.bind(null, id), undefined);
  return (
    <form action={run} className="space-y-4">
      <h2 className="font-semibold">Hotel details</h2>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div><label className="label" htmlFor="hn">Hotel name</label><input id="hn" name="name" className="input" defaultValue={name} required /></div>
      <div><label className="label" htmlFor="hnotes">Notes <span className="font-normal text-ink-mute">(only Super Admins)</span></label>
        <textarea id="hnotes" name="notes" rows={2} className="input" defaultValue={notes} placeholder="Contact person, plan, invoice number…" /></div>
      <SubmitButton className="btn-secondary">Save details</SubmitButton>
    </form>
  );
}

type Admin = { id: string; username: string; name: string; email: string | null; active: boolean; must_change_password: boolean; locked: boolean; totp: boolean; last_seen: string | null };

export function AdminAccounts({ propertyId, code, admins }: { propertyId: string; code: string; admins: Admin[] }) {
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [off2fa, setOff2fa] = useState(false);
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(admins.length === 0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [addState, addRun] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = await createAdmin(propertyId, prev, fd);
    if (r.ok && r.password) { setCreds({ username: r.username!, password: r.password }); setAdding(false); router.refresh(); }
    return r;
  }, undefined);
  return (
    <section id="admins">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold">Admin accounts</h2><p className="text-sm text-ink-mute">Admins manage the hotel&apos;s own users, forms and settings.</p></div>
        {!adding && <button className="btn-secondary btn-sm" onClick={() => { setAdding(true); setCreds(null); }}><UserPlus className="h-4 w-4" /> Add admin</button>}
      </div>
      {creds && <div className="mb-4"><Credentials code={code} username={creds.username} password={creds.password} /></div>}
      {err && <div className="mb-3"><Alert kind="error">{err}</Alert></div>}
      {admins.length === 0 && !adding && <Alert kind="warn">This hotel has no admin. Add one so they can manage it.</Alert>}
      <ul className="divide-y divide-ink-line">
        {admins.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.name} <span className="font-mono text-sm text-ink-mute">{a.username}</span></p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">{a.email ?? "no e-mail"} · {a.last_seen ? `last sign-in ${a.last_seen}` : "never signed in"}
                  {!a.active && <span className="badge bg-slate-100 text-slate-700">Deactivated</span>}
                  {a.locked && <span className="badge bg-red-50 text-red-700"><Lock className="h-3 w-3" /> Locked</span>}
                  {a.must_change_password && <span className="badge bg-amber-50 text-amber-800">Temporary password</span>}
                  {a.totp && <span className="badge bg-emerald-50 text-emerald-800"><ShieldCheck className="h-3 w-3" /> 2FA</span>}</p>
              </div>
              {resetFor !== a.id && <button className="btn-secondary btn-sm" onClick={() => { setResetFor(a.id); setPw(""); setOff2fa(false); setErr(null); setCreds(null); }}><KeyRound className="h-4 w-4" /> Reset password</button>}
            </div>
            {resetFor === a.id && (
              <div className="mt-3 space-y-3 rounded-lg bg-ink-wash/60 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div><label className="label" htmlFor={`pw-${a.id}`}>New temporary password</label>
                    <input id={`pw-${a.id}`} className="input w-56 font-mono" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave empty to generate" /></div>
                  <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
                    const r = await resetAdminPassword(propertyId, a.id, { password: pw, turnOff2fa: off2fa });
                    if ("error" in r && r.error) { setErr(r.error); return; }
                    if ("password" in r && r.password) { setCreds({ username: r.username, password: r.password }); setResetFor(null); setErr(null); router.refresh(); }
                  })}>Reset password</button>
                  <button className="btn-ghost btn-sm" onClick={() => setResetFor(null)}>Cancel</button>
                </div>
                {a.totp && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={off2fa} onChange={(e) => setOff2fa(e.target.checked)} /> Also turn off two-factor (they lost their phone)</label>}
                <p className="text-xs text-ink-mute">They&apos;ll be signed out everywhere, unlocked if locked, and asked to choose their own password at next sign-in.</p>
              </div>)}
          </li>))}
      </ul>
      {adding && (
        <form action={addRun} className="mt-4 space-y-3 rounded-lg border border-ink-line p-4">
          <h3 className="font-medium">New admin</h3>
          {addState && "error" in addState && addState.error && <Alert kind="error">{addState.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="na-name">Full name</label><input id="na-name" name="name" className="input" required /></div>
            <div><label className="label" htmlFor="na-user">Username</label><input id="na-user" name="username" className="input" required defaultValue={admins.length ? "" : "admin"} /></div>
            <div><label className="label" htmlFor="na-email">E-mail <span className="font-normal text-ink-mute">(optional)</span></label><input id="na-email" name="email" type="email" className="input" /></div>
            <div><label className="label" htmlFor="na-pw">Temporary password</label><input id="na-pw" name="password" className="input font-mono" placeholder="Leave empty to generate" /></div>
          </div>
          <div className="flex gap-2"><SubmitButton className="btn-primary" pendingText="Creating…">Create admin</SubmitButton>{admins.length > 0 && <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>}</div>
        </form>)}
    </section>
  );
}

export function DangerZone({ id, code, name, counts, onDeleted }: { id: string; code: string; name: string; counts: { users: number; forms: number; subs: number }; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section>
      <div className="rounded-lg p-4 ring-1 ring-red-200">
        <h2 className="font-semibold text-red-800">Delete hotel</h2>
        <p className="mt-1 text-sm text-ink-soft">Permanently removes <b>{name}</b> with its {counts.users} users, {counts.forms} forms, {counts.subs} requests, attachments and history. This can&apos;t be undone — to stop access but keep the data, suspend it or let the subscription end instead.</p>
        {!open ? <button className="btn-danger btn-sm mt-3" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /> Delete hotel…</button> : (
          <div className="mt-3 space-y-2">
            {err && <Alert kind="error">{err}</Alert>}
            <label className="label" htmlFor="confirm-code">Type <span className="font-mono">{code}</span> to confirm</label>
            <div className="flex flex-wrap gap-2">
              <input id="confirm-code" className="input w-48 font-mono uppercase" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoComplete="off" />
              <button className="btn-danger" disabled={pending || typed !== code.toUpperCase()} onClick={() => start(async () => {
                const r = await deleteHotel(id, typed);
                if ("error" in r && r.error) { setErr(r.error); return; }
                onDeleted?.(); router.replace("/platform?deleted=" + encodeURIComponent(code)); router.refresh();
              })}>{pending ? "Deleting…" : "Delete permanently"}</button>
              <button className="btn-ghost" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
            </div>
          </div>)}
      </div>
    </section>
  );
}

export function PlanPanel({ id, limit, enabled }: { id: string; limit: number | null; enabled: number }) {
  const [v, setV] = useState(limit === null ? "" : String(limit));
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "warn"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (val: string) => start(async () => {
    const r = await setFormTypeLimit(id, val.trim() === "" ? null : Number(val));
    if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
    const over = "over" in r ? r.over : 0;
    setMsg(over ? { kind: "warn", text: `Saved. The hotel has ${over} more enabled than allowed — they stay on, but no more can be enabled until some are disabled.` }
      : { kind: "success", text: val.trim() === "" ? "Form types: unlimited." : `Form types allowed: ${val}.` });
    router.refresh();
  });
  return (
    <section className="space-y-3" id="plan">
      <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-brand-600" /><h2 className="font-semibold">Plan · form types</h2></div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <p className="text-sm text-ink-soft"><b>{enabled}</b> of <b>{limit ?? "unlimited"}</b> form types enabled. Submissions are unlimited; drafts and disabled forms don&apos;t count.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="label" htmlFor="ftl">Form types allowed</label>
          <input id="ftl" type="number" min={0} max={9999} className="input w-40" value={v} onChange={(e) => setV(e.target.value)} placeholder="Unlimited" /></div>
        <button className="btn-primary" disabled={pending || v === (limit === null ? "" : String(limit))} onClick={() => save(v)}>Save limit</button>
        {[5, 10, 20].map((n) => <button key={n} className="btn-secondary btn-sm" disabled={pending} onClick={() => { setV(String(n)); save(String(n)); }}>{n}</button>)}
        <button className="btn-ghost btn-sm" disabled={pending || limit === null} onClick={() => { setV(""); save(""); }}>Unlimited</button>
      </div>
    </section>
  );
}
