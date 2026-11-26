import Link from "next/link";
import { requireAdmin, asUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserPlus, Users } from "lucide-react";

export const metadata = { title: "Users & Groups" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const q = (await searchParams).q?.trim() || null;
  const like = q ? `%${q}%` : null;
  const users = await asUser(admin, (tx) => tx<{ id: string; username: string; name: string; email: string | null; department: string | null; is_admin: boolean; can_build_forms: boolean; active: boolean; locked: boolean; must_change_password: boolean; groups: string | null }[]>`
    select u.id, u.username, u.name, u.email, u.department, u.is_admin, u.can_build_forms, u.active, u.must_change_password,
      coalesce(u.locked_until > now(), false) as locked,
      (select string_agg(g.name, ', ' order by g.name) from group_members gm join groups g on g.id = gm.group_id where gm.user_id = u.id) as groups
    from users u where (${like}::text is null or u.name ilike ${like} or u.username ilike ${like} or coalesce(u.department,'') ilike ${like})
    order by u.active desc, u.name`);
  return (
    <>
      <PageHeader title="Users & Groups" subtitle={`${users.length} users in ${admin.property_name}`}
        actions={<><Link href="/users/groups" className="btn-secondary"><Users className="h-4 w-4" /> Groups</Link><Link href="/users/new" className="btn-primary"><UserPlus className="h-4 w-4" /> Add user</Link></>} />
      <form className="mb-4"><input name="q" defaultValue={q ?? ""} className="input max-w-sm" placeholder="Search name, username, department…" aria-label="Search users" /></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Username</th><th>Department</th><th>Groups</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} className={u.active ? "hover:bg-ink-wash/60" : "opacity-60"}>
              <td><Link href={`/users/${u.id}`} className="font-medium text-ink hover:text-brand-700">{u.name}</Link><p className="text-xs text-ink-mute">{u.email ?? "no e-mail"}</p></td>
              <td className="font-mono text-xs">{u.username}</td>
              <td className="text-ink-soft">{u.department ?? "—"}</td>
              <td className="text-ink-soft">{u.groups ?? "—"}</td>
              <td>{u.is_admin ? <span className="badge bg-brand-50 text-brand-700">Admin</span> : u.can_build_forms ? <span className="badge bg-cyan-50 text-cyan-800">Form owner</span> : <span className="text-ink-mute">User</span>}</td>
              <td>{!u.active ? <span className="badge bg-zinc-100 text-zinc-600">Inactive</span> : u.locked ? <span className="badge bg-red-50 text-red-700">Locked</span> : u.must_change_password ? <span className="badge bg-amber-50 text-amber-800">Temp password</span> : <span className="badge bg-emerald-50 text-emerald-700">Active</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </>
  );
}
