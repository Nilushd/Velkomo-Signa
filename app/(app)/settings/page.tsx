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
    </div>
  );
}
