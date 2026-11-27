import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin, asUser } from "@/lib/auth";
import { PageHeader, Alert } from "@/components/ui";
import { UserForm } from "@/components/user-form";
import { updateUser, setActive, unlockUser } from "@/app/actions/users";
import { UserAccessTable, UserGroups, ResetPasswordForm, RoleSwitches } from "./client";
import { AccessLegend } from "@/components/access-levels";
import { DelegationPanel } from "@/components/delegation-panel";
import { loadDelegations, approvableForms } from "@/lib/delegation";

export const metadata = { title: "User" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const data = await asUser(admin, async (tx) => {
    const [u] = await tx<{ id: string; username: string; name: string; email: string | null; department: string | null; is_admin: boolean; can_build_forms: boolean; active: boolean; locked_until: Date | null; must_change_password: boolean }[]>`
      select id, username, name, email, department, is_admin, can_build_forms, active, locked_until, must_change_password from users where id = ${id}`;
    if (!u) return null;
    const forms = await tx<{ id: string; title: string; status: string; visibility: string; access: string | null; via_group: string | null }[]>`
      select f.id, f.title, f.status, f.visibility,
        (select access from form_access fa where fa.form_id = f.id and fa.user_id = ${id}) as access,
        (select string_agg(g.name || ' (' || case fa.access when 'approve' then 'Approval' when 'review' then 'Review' else 'General' end || ')', ', ') from form_access fa join groups g on g.id = fa.group_id join group_members gm on gm.group_id = g.id
           where fa.form_id = f.id and gm.user_id = ${id}) as via_group
      from forms f order by f.title`;
    const groups = await tx<{ id: string; name: string; member: boolean }[]>`
      select g.id, g.name, exists(select 1 from group_members gm where gm.group_id = g.id and gm.user_id = ${id}) as member from groups g order by g.name`;
    const people = await tx<{ id: string; name: string; department: string | null }[]>`select id, name, department from users where active order by name`;
    return { u, forms, groups, people, dl: await loadDelegations(tx, id), approvable: await approvableForms(tx, id) };
  });
  if (!data) notFound();
  const { u } = data;
  const locked = u.locked_until && u.locked_until > new Date();
  return (
    <div className="space-y-6">
      <Link href="/users" className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Users</Link>
      <PageHeader title={u.name} subtitle={`@${u.username}${u.active ? "" : " · inactive"}`}
        actions={u.id !== admin.id ? <form action={setActive.bind(null, u.id, !u.active)}><button className={u.active ? "btn-secondary" : "btn-primary"}>{u.active ? "Deactivate" : "Reactivate"}</button></form> : undefined} />
      {(await searchParams).created && <Alert kind="success">User created. You can change their permissions and form access below at any time.</Alert>}
      {locked && <div className="flex items-center gap-3"><Alert kind="warn">Locked after 5 failed sign-ins until {u.locked_until!.toLocaleTimeString()}.</Alert><form action={unlockUser.bind(null, u.id)}><button className="btn-secondary btn-sm">Unlock now</button></form></div>}
      <section className="card p-5"><h2 className="mb-4 font-semibold">Details</h2><UserForm action={updateUser.bind(null, u.id)} user={u} /></section>
      <section className="card space-y-5 p-5" id="permissions">
        <div><h2 className="font-semibold">Permissions</h2><p className="text-sm text-ink-mute">Changes save as soon as you make them.</p></div>
        <RoleSwitches userId={u.id} isAdmin={u.is_admin} designer={u.can_build_forms} self={u.id === admin.id} />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-soft">Form access — choose for each form</h3>
          <AccessLegend />
          {u.is_admin && <p className="text-xs text-ink-mute">As an Admin they can already see every form and submission; to make them an approver, give Approval access on that form.</p>}
          <UserAccessTable userId={u.id} forms={data.forms} />
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Out of office</h2>
        <p className="mb-4 mt-1 text-sm text-ink-mute">Forward {u.name}&apos;s approvals to a colleague while they&apos;re on leave.</p>
        <DelegationPanel fromUserId={u.id} self={u.id === admin.id} people={data.people} forms={data.approvable} forwarding={data.dl.forwarding} covering={data.dl.covering} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-semibold">Groups</h2><UserGroups userId={u.id} groups={data.groups} /></section>
        <section className="card p-5"><h2 className="mb-1 font-semibold">Reset password</h2><p className="mb-3 text-sm text-ink-mute">Sets a temporary password. They must change it at next sign-in.</p><ResetPasswordForm userId={u.id} /></section>
      </div>
    </div>
  );
}
