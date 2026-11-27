import { rootSql } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { AdminsClient } from "./client";

export const metadata = { title: "Super Admins" };

export default async function AdminsPage() {
  const me = await requirePlatformAdmin();
  const rows = await rootSql()<{ id: string; username: string; name: string; email: string | null; active: boolean; must_change_password: boolean; totp: boolean; locked: boolean; seen: Date | null }[]>`
    select a.id, a.username, a.name, a.email, a.active, a.must_change_password, (a.totp_enabled_at is not null) as totp,
      (a.locked_until is not null and a.locked_until > now()) as locked, (select max(created_at) from platform_sessions where admin_id = a.id) as seen
    from platform_admins a order by a.active desc, a.created_at`;
  return (
    <>
      <PageHeader title="Super Admins" subtitle="People who can run the Platform. They sign in on the normal login page with property code PLATFORM." />
      <AdminsClient meId={me.id} rows={rows.map(({ seen, ...r }) => ({ ...r, last_seen: seen ? fmtDate(seen) : null }))} />
    </>
  );
}
