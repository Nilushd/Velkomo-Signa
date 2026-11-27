import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { loadDelegations, approvableForms } from "@/lib/delegation";
import { DelegationPanel } from "@/components/delegation-panel";
import { PageHeader } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import { PropertyForm } from "./property-form";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const u = await requireUser();
  const { people, dl, forms } = await asUser(u, async (tx) => ({
    people: await tx<{ id: string; name: string; department: string | null }[]>`select id, name, department from users where active order by name`,
    dl: await loadDelegations(tx, u.id),
    forms: await approvableForms(tx, u.id),
  }));
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
        </dl>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/change-password" className="btn-secondary">Change password</Link><PushToggle /></div>
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
        </section>)}
    </div>
  );
}
