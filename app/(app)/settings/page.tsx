import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { loadDelegations, approvableForms } from "@/lib/delegation";
import { DelegationPanel } from "@/components/delegation-panel";
import { EmailPref } from "@/components/email-pref";
import { TwoFactorPanel } from "@/components/two-factor-panel";
import { rootSql } from "@/lib/db";
import { Alert } from "@/components/ui";
import { storageUsage } from "@/lib/housekeeping";
import { usesObjectStorage } from "@/lib/storage";
import { PageHeader } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import { PropertyForm } from "./property-form";
import { utcOffset, localTime } from "@/lib/timezones";
import { privacyOf, standardNotice, deviceName } from "@/lib/privacy";
import { PrivacySettingsForm, PrivacyRequests, YourData } from "@/components/privacy-panels";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ backup?: string }> }) {
  const u = await requireUser();
  const { backup } = await searchParams;
  const [tf] = await rootSql()<{ n: number | null }[]>`select cardinality(recovery_codes) as n from users where id = ${u.id}`;
  const { people, dl, forms } = await asUser(u, async (tx) => ({
    people: await tx<{ id: string; name: string; department: string | null }[]>`select id, name, department from users where active order by name`,
    dl: await loadDelegations(tx, u.id),
    forms: await approvableForms(tx, u.id),
  }));
  const usage = u.is_admin ? await storageUsage(u.property_id) : null;
  const signIns = (await rootSql()<{ at: Date; ip_prefix: string | null; user_agent: string | null; method: string }[]>`
    select at, ip_prefix, user_agent, method from login_events where user_id = ${u.id} order by at desc limit 8`)
    .map((s) => ({ when: fmtDate(s.at, true, u.time_zone), where: s.ip_prefix ?? "", device: deviceName(s.user_agent), method: s.method }));
  const pv = u.is_admin ? await privacyOf(u.property_id) : null;
  const preqs = u.is_admin ? await asUser(u, (tx) => tx<{ id: string; requester_name: string; kind: string; details: string | null; status: string; response: string | null; created_at: Date; age_days: number }[]>`
    select id, requester_name, kind, details, status, response, created_at, (current_date - created_at::date)::int as age_days from privacy_requests
    order by (status = 'open') desc, created_at desc limit 50`) : [];
  const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />
      <section className="card p-5">
        <h2 className="font-semibold">Your account</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-mute">Name</dt><dd>{u.name}</dd></div>
          <div><dt className="text-ink-mute">Username</dt><dd className="font-mono">{u.username}</dd></div>
          <div><dt className="text-ink-mute">E-mail</dt><dd>{u.email ?? "Not set — ask your admin (needed for e-mail approvals)"}</dd></div>
          <div><dt className="text-ink-mute">Property</dt><dd>{u.property_name} ({u.property_code})</dd></div>
          <div><dt className="text-ink-mute">Time zone</dt><dd>{u.time_zone.replace(/_/g, " ")} ({utcOffset(u.time_zone)}) · now {localTime(u.time_zone)}<span className="block text-xs text-ink-mute">All dates and times are shown in this zone. Set by Velkomo.</span></dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/change-password" className="btn-secondary">Change password</Link></div>
      </section>
      {backup !== undefined && <Alert kind="info">You signed in with a backup code. {backup} left — make new ones below if you&apos;re running low.</Alert>}
      <section className="card space-y-3 p-5" id="two-factor">
        <div><h2 className="font-semibold">Two-factor authentication</h2><p className="text-sm text-ink-mute">Extra protection when signing in.</p></div>
        <TwoFactorPanel enabled={u.totp_enabled} backupLeft={u.totp_enabled ? tf?.n ?? 0 : null} />
      </section>
      <section className="card space-y-3 p-5" id="notifications">
        <div><h2 className="font-semibold">Notifications</h2><p className="text-sm text-ink-mute">How approval requests reach you.</p></div>
        <EmailPref initial={u.email_approvals} email={u.email} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-line p-3">
          <div><p className="text-sm font-semibold">Phone / browser push</p><p className="text-xs text-ink-mute">Pop-up alerts on this device, even when the app is closed.</p></div>
          <PushToggle explain />
        </div>
      </section>
      <section className="card p-5" id="out-of-office">
        <h2 className="font-semibold">Out of office — forward my approvals</h2>
        <p className="mb-4 mt-1 text-sm text-ink-mute">Going on leave? Choose a colleague to approve in your place for those days.</p>
        <DelegationPanel fromUserId={u.id} self people={people} forms={forms} forwarding={dl.forwarding} covering={dl.covering} />
      </section>
      <section className="card p-5" id="your-data">
        <h2 className="font-semibold">Your data</h2>
        <p className="mb-4 mt-1 text-sm text-ink-mute">See what&apos;s held about you, ask for changes, and check where you&apos;re signed in.</p>
        <YourData signIns={signIns} />
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Install the app</h2>
        <p className="mt-1 text-sm text-ink-soft">Velkomo Signa works on any phone. Open it in your browser and choose <b>Add to Home Screen</b> (iPhone: Share → Add to Home Screen; Android: menu → Install app). Then turn on push notifications above to hear about new approvals.</p>
      </section>
      {u.is_admin && (
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Property</h2>
          <PropertyForm name={u.property_name} logo={u.property_logo} code={u.property_code} />
          {usage && (
            <div className="mt-5 grid gap-3 border-t border-ink-line pt-4 text-sm sm:grid-cols-3">
              <div><p className="text-ink-mute">Attachments &amp; logos</p><p className="font-semibold">{mb(usage.fileBytes)} <span className="font-normal text-ink-mute">· {usage.files} files</span></p></div>
              <div><p className="text-ink-mute">Form answers &amp; history</p><p className="font-semibold">{mb(usage.dataBytes)}</p></div>
              <div><p className="text-ink-mute">Files are stored in</p><p className="font-semibold">{usesObjectStorage() ? "Supabase Storage" : "the database (dev mode)"}</p></div>
              <p className="text-xs text-ink-mute sm:col-span-3">Photos are shrunk on the phone before upload; unused uploads, old e-mail copies and old notifications are cleaned up every night.</p>
            </div>)}
        </section>)}
      {u.is_admin && pv && (
        <section className="card p-5" id="privacy">
          <h2 className="font-semibold">Privacy &amp; data protection</h2>
          <p className="mb-4 mt-1 text-sm text-ink-mute">{u.property_name} is responsible for the information in its forms. These settings feed the privacy notice linked from every form.</p>
          <PrivacySettingsForm p={{ contactName: pv.contactName, contactEmail: pv.contactEmail, notice: pv.notice, retention: pv.retentionMonths, consentAll: pv.consentAllForms, version: pv.version }}
            standardPreview={standardNotice(pv).map((s) => `${s.heading}\n${s.body.join("\n")}`).join("\n\n")} />
        </section>)}
      {u.is_admin && (
        <section className="card p-5" id="privacy-requests">
          <h2 className="font-semibold">Privacy requests</h2>
          <p className="mb-3 mt-1 text-sm text-ink-mute">Requests to see, correct or delete information. Most laws expect a reply within one month (Sri Lanka: 21 working days).</p>
          <PrivacyRequests rows={preqs.map((r) => ({ ...r, created: fmtDate(r.created_at, true, u.time_zone) }))} />
        </section>)}
    </div>
  );
}
