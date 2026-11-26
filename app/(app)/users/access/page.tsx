import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin, asUser } from "@/lib/auth";
import { PageHeader, Alert } from "@/components/ui";
import { FeatureTable } from "./table";

export const metadata = { title: "Feature access" };

export default async function FeatureAccessPage() {
  const admin = await requireAdmin();
  const users = await asUser(admin, (tx) => tx<{ id: string; name: string; username: string; department: string | null; is_admin: boolean; can_build_forms: boolean; can_use_studio: boolean; can_use_ai: boolean }[]>`
    select id, name, username, department, is_admin, can_build_forms, can_use_studio, can_use_ai from users where active order by is_admin desc, name`);
  return (
    <>
      <Link href="/users" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Users</Link>
      <PageHeader title="Feature access" subtitle="Switch the form-building features on or off for each person. Changes save immediately." />
      {!process.env.ANTHROPIC_API_KEY && <div className="mb-4"><Alert kind="info">AI design isn&apos;t set up on this server yet (no ANTHROPIC_API_KEY), so the AI switch has no effect until it is.</Alert></div>}
      <FeatureTable users={users} />
      <p className="mt-3 text-xs text-ink-mute">Everyone can fill in forms they have access to and approve where they are chosen as an approver — that is set per form (Access and Approvals tabs) or on each user&apos;s page.</p>
    </>
  );
}
