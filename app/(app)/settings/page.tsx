import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import { PropertyForm } from "./property-form";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const u = await requireUser();
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
