import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin, asUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { GroupsClient } from "./client";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const admin = await requireAdmin();
  const data = await asUser(admin, async (tx) => ({
    groups: await tx<{ id: string; name: string; members: string[] }[]>`
      select g.id, g.name, coalesce(array_agg(gm.user_id) filter (where gm.user_id is not null), '{}') as members
      from groups g left join group_members gm on gm.group_id = g.id group by g.id order by g.name`,
    users: await tx<{ id: string; name: string; department: string | null }[]>`select id, name, department from users where active order by name`,
  }));
  return (
    <>
      <Link href="/users" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Users</Link>
      <PageHeader title="Groups" subtitle="Give a whole team access to a form, or make a team an approver, in one step." />
      <GroupsClient groups={data.groups} users={data.users} />
    </>
  );
}
