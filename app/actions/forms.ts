"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBuilder, requireUser, asUser, asSystem, type SessionUser } from "@/lib/auth";
import { formAccess, canEditForm, reviewerIds } from "@/lib/access";
import { shortCode } from "@/lib/crypto";
import { FIELD_TYPES, type FormRow } from "@/lib/types";
import type { Sql } from "@/lib/db";

const fieldSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(FIELD_TYPES.map((f) => f.type) as [string, ...string[]]),
  label: z.string().max(200),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  help: z.string().max(500).optional(),
  options: z.array(z.string().max(200)).max(200).optional(),
  multiple: z.boolean().optional(),
  maxFiles: z.number().int().min(1).max(20).optional(),
});
const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  font: z.enum(["sans", "serif", "rounded"]).optional(),
  logoSource: z.enum(["property", "custom", "none"]).optional(),
  logoFileId: z.string().uuid().nullable().optional(),
  logoAlign: z.enum(["left", "center", "right"]).optional(),
  logoSize: z.enum(["s", "m", "l"]).optional(),
  showPropertyName: z.boolean().optional(),
  formCode: z.string().max(60).optional(),
  printFooter: z.string().max(300).optional(),
  thankYou: z.string().max(1000).optional(),
});

async function editable(u: SessionUser, tx: Sql, formId: string) {
  const [f] = await tx<FormRow[]>`select * from forms where id = ${formId}`;
  if (!f) throw new Error("Form not found");
  if (!canEditForm(await formAccess(tx, u, f))) throw new Error("You can't edit this form");
  return f;
}

export async function createForm(input: { title?: string; schema?: unknown }) {
  const u = await requireBuilder();
  const schema = z.array(fieldSchema).max(200).parse(input.schema ?? []);
  const title = (input.title || "Untitled form").slice(0, 200);
  const id = await asUser(u, async (tx) => {
    const [f] = await tx<{ id: string }[]>`
      insert into forms (property_id, owner_id, title, short_code, schema, theme)
      values (${u.property_id}, ${u.id}, ${title}, ${shortCode()}, ${tx.json(schema as never)},
        ${tx.json({ primary: "#2563EB", background: "#F4F7FC", font: "sans", logoSource: "property", logoAlign: "left", logoSize: "m", showPropertyName: true, thankYou: "Thank you! Your request has been received." })})
      returning id`;
    return f.id;
  });
  redirect(`/forms/${id}/edit`);
}

export async function saveForm(formId: string, input: { title: string; description: string; schema: unknown; theme: unknown }) {
  const u = await requireUser();
  const schema = z.array(fieldSchema).max(200).parse(input.schema);
  const theme = themeSchema.parse(input.theme);
  const ids = new Set(schema.map((f) => f.id));
  if (ids.size !== schema.length) return { error: "Two fields have the same id." };
  for (const f of schema) {
    if (["select", "radio"].includes(f.type) && !(f.options?.filter(Boolean).length)) return { error: `“${f.label || "Untitled"}” needs at least one option.` };
    if (!f.label.trim()) return { error: "Every field needs a label." };
  }
  await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    await tx`update forms set title = ${input.title.trim().slice(0, 200) || "Untitled form"}, description = ${input.description.slice(0, 2000)},
      schema = ${tx.json(schema as never)}, theme = ${tx.json(theme as never)}, updated_at = now() where id = ${formId}`;
  });
  revalidatePath(`/forms/${formId}/edit`);
  return { ok: true };
}

export async function setStatus(formId: string, status: "draft" | "published" | "closed") {
  const u = await requireUser();
  const res = await asUser(u, async (tx) => {
    const f = await editable(u, tx, formId);
    if (status === "published") {
      if ((f.schema as unknown[]).length === 0) return { error: "Add at least one field before publishing." };
      const problem = await approvalProblem(tx, formId);
      if (problem) return { error: problem };
    }
    await tx`update forms set status = ${status}, updated_at = now() where id = ${formId}`;
    return { ok: true };
  });
  revalidatePath(`/forms/${formId}/edit`);
  revalidatePath("/forms");
  return res;
}

export async function saveSettings(formId: string, input: { closesAt: string | null; maxSubmissions: number | null }) {
  const u = await requireUser();
  const closes = input.closesAt ? new Date(input.closesAt) : null;
  const max = input.maxSubmissions && input.maxSubmissions > 0 ? Math.floor(input.maxSubmissions) : null;
  await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    await tx`update forms set closes_at = ${closes}, max_submissions = ${max}, updated_at = now() where id = ${formId}`;
  });
  revalidatePath(`/forms/${formId}/edit`);
  return { ok: true };
}

export interface AccessEntry { userId?: string; groupId?: string; access: "general" | "review" }

/** Replace the access list. Approvers who lose Review access are removed from levels (and reported). */
export async function saveAccess(formId: string, entries: AccessEntry[]) {
  const u = await requireUser();
  const list = z.array(z.object({ userId: z.string().uuid().optional(), groupId: z.string().uuid().optional(), access: z.enum(["general", "review"]) })).parse(entries);
  const removed = await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    await tx`delete from form_access where form_id = ${formId}`;
    for (const e of list) {
      if (!!e.userId === !!e.groupId) continue;
      await tx`insert into form_access (property_id, form_id, user_id, group_id, access)
        values (${u.property_id}, ${formId}, ${e.userId ?? null}, ${e.groupId ?? null}, ${e.access}) on conflict do nothing`;
    }
    return pruneApprovers(tx, formId);
  });
  revalidatePath(`/forms/${formId}/edit`);
  return { ok: true, removed };
}

/** Remove approvers (users/groups) that no longer have Review access on the form. Returns their names. */
export async function pruneApprovers(tx: Sql, formId: string): Promise<string[]> {
  const gone = await tx<{ id: string; name: string }[]>`
    select sa.id, coalesce(u.name, g.name) as name from approval_step_approvers sa
    join approval_steps st on st.id = sa.step_id and st.form_id = ${formId}
    left join users u on u.id = sa.user_id left join groups g on g.id = sa.group_id
    where (sa.user_id is not null and sa.user_id not in (
            select user_id from form_access where form_id = ${formId} and access = 'review' and user_id is not null
            union select gm.user_id from form_access fa join group_members gm on gm.group_id = fa.group_id where fa.form_id = ${formId} and fa.access = 'review'))
       or (sa.group_id is not null and sa.group_id not in (select group_id from form_access where form_id = ${formId} and access = 'review' and group_id is not null))`;
  if (gone.length) await tx`delete from approval_step_approvers where id in ${tx(gone.map((g) => g.id))}`;
  return gone.map((g) => g.name);
}

async function approvalProblem(tx: Sql, formId: string): Promise<string | null> {
  const steps = await tx<{ level: number; name: string; n: number }[]>`
    select st.level, st.name, count(sa.id)::int as n from approval_steps st left join approval_step_approvers sa on sa.step_id = st.id
    where st.form_id = ${formId} group by st.level, st.name order by st.level`;
  const empty = steps.find((s) => s.n === 0);
  return empty ? `Approval level ${empty.level} (“${empty.name}”) has no approver.` : null;
}

export interface StepInput { name: string; channel: "email" | "app" | "both"; reminderDays: number | null; approvers: { userId?: string; groupId?: string }[] }

export async function saveApprovals(formId: string, steps: StepInput[]) {
  const u = await requireUser();
  const parsed = z.array(z.object({
    name: z.string().min(1, "Every level needs a name").max(120),
    channel: z.enum(["email", "app", "both"]),
    reminderDays: z.number().int().min(1).max(60).nullable(),
    approvers: z.array(z.object({ userId: z.string().uuid().optional(), groupId: z.string().uuid().optional() })),
  })).max(5, "At most 5 levels").safeParse(steps);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    const reviewers = await reviewerIds(tx, formId);
    const reviewGroups = new Set((await tx<{ group_id: string }[]>`select group_id from form_access where form_id = ${formId} and access = 'review' and group_id is not null`).map((r) => r.group_id));
    for (const [i, s] of parsed.data.entries()) {
      if (s.approvers.length === 0) return { error: `Level ${i + 1} needs at least one approver.` };
      for (const a of s.approvers) {
        if (a.userId && !reviewers.has(a.userId)) return { error: `Level ${i + 1}: an approver doesn't have Review access to this form.` };
        if (a.groupId && !reviewGroups.has(a.groupId)) return { error: `Level ${i + 1}: a group doesn't have Review access to this form.` };
      }
    }
    await tx`delete from approval_steps where form_id = ${formId}`;
    for (const [i, s] of parsed.data.entries()) {
      const [st] = await tx<{ id: string }[]>`insert into approval_steps (property_id, form_id, level, name, channel, reminder_days)
        values (${u.property_id}, ${formId}, ${i + 1}, ${s.name}, ${s.channel}, ${s.reminderDays}) returning id`;
      for (const a of s.approvers)
        await tx`insert into approval_step_approvers (property_id, step_id, user_id, group_id) values (${u.property_id}, ${st.id}, ${a.userId ?? null}, ${a.groupId ?? null})`;
    }
    return { ok: true };
  });
  revalidatePath(`/forms/${formId}/edit`);
  return res;
}

export async function deleteForm(formId: string) {
  const u = await requireUser();
  await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from submissions where form_id = ${formId}`;
    if (n > 0) throw new Error("This form has submissions. Close it instead of deleting it.");
    await tx`delete from forms where id = ${formId}`;
  });
  redirect("/forms");
}

export async function duplicateForm(formId: string) {
  const u = await requireBuilder();
  const id = await asUser(u, async (tx) => {
    const f = await editable(u, tx, formId);
    const [n] = await tx<{ id: string }[]>`insert into forms (property_id, owner_id, title, description, short_code, schema, theme, visibility)
      values (${u.property_id}, ${u.id}, ${f.title + " (copy)"}, ${f.description}, ${shortCode()}, ${tx.json(f.schema as never)}, ${tx.json(f.theme as never)}, ${f.visibility}) returning id`;
    return n.id;
  });
  redirect(`/forms/${id}/edit`);
}

export async function transferOwner(formId: string, ownerId: string) {
  const u = await requireUser();
  if (!u.is_admin) return { error: "Only admins can change the owner." };
  await asSystem(u.property_id, (tx) => tx`update forms set owner_id = ${ownerId} where id = ${formId}`);
  revalidatePath(`/forms/${formId}/edit`);
  return { ok: true };
}

export async function saveVisibility(formId: string, visibility: string) {
  const u = await requireUser();
  const v = z.enum(["public", "all_users", "assigned"]).parse(visibility);
  await asUser(u, async (tx) => {
    await editable(u, tx, formId);
    await tx`update forms set visibility = ${v}, updated_at = now() where id = ${formId}`;
  });
  revalidatePath(`/forms/${formId}/edit`);
  return { ok: true };
}
