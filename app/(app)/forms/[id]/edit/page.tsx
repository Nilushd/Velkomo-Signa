import { notFound } from "next/navigation";
import { requireUser, asUser } from "@/lib/auth";
import { formAccess, canEditForm } from "@/lib/access";
import { appUrl } from "@/lib/env";
import type { FormRow } from "@/lib/types";
import { Builder, type BuilderData } from "@/components/builder/builder";

export const metadata = { title: "Form builder" };

export default async function EditForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const u = await requireUser();
  const data = await asUser(u, async (tx): Promise<BuilderData | null> => {
    const [f] = await tx<FormRow[]>`select * from forms where id = ${id}`;
    if (!f || !canEditForm(await formAccess(tx, u, f))) return null;
    const users = await tx<{ id: string; name: string; username: string; department: string | null; email: string | null }[]>`
      select id, name, username, department, email from users where active order by name`;
    const groups = await tx<{ id: string; name: string; members: number }[]>`
      select g.id, g.name, (select count(*)::int from group_members gm where gm.group_id = g.id) as members from groups g order by g.name`;
    const access = await tx<{ user_id: string | null; group_id: string | null; access: "general" | "review" }[]>`
      select user_id, group_id, access from form_access where form_id = ${id}`;
    const steps = await tx<{ id: string; level: number; name: string; channel: "email" | "app" | "both"; reminder_days: number | null }[]>`
      select id, level, name, channel, reminder_days from approval_steps where form_id = ${id} order by level`;
    const approvers = await tx<{ step_id: string; user_id: string | null; group_id: string | null }[]>`
      select sa.step_id, sa.user_id, sa.group_id from approval_step_approvers sa join approval_steps st on st.id = sa.step_id where st.form_id = ${id}`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from submissions where form_id = ${id}`;
    return {
      form: { id: f.id, title: f.title, description: f.description, schema: f.schema, theme: f.theme, status: f.status, visibility: f.visibility,
        shortCode: f.short_code, closesAt: f.closes_at ? f.closes_at.toISOString().slice(0, 16) : "", maxSubmissions: f.max_submissions, ownerId: f.owner_id },
      users, groups,
      access: access.map((a) => ({ userId: a.user_id ?? undefined, groupId: a.group_id ?? undefined, access: a.access })),
      steps: steps.map((s) => ({ name: s.name, channel: s.channel, reminderDays: s.reminder_days,
        approvers: approvers.filter((a) => a.step_id === s.id).map((a) => ({ userId: a.user_id ?? undefined, groupId: a.group_id ?? undefined })) })),
      submissionCount: n,
      url: `${appUrl()}/f/${f.short_code}`,
      isAdmin: u.is_admin,
      propertyName: u.property_name,
      propertyLogo: u.property_logo,
    };
  });
  if (!data) notFound();
  return <Builder data={data} fromStudio={from === "studio"} />;
}
