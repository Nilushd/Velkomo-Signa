import type { Sql } from "./db";
import type { FormRow } from "./types";

/** Per-form access. general: submit + own requests · review: + see all submissions · approve: + can be chosen as approver. */
export type Access = "admin" | "owner" | "approve" | "review" | "general" | null;
export type FormAccessLevel = "general" | "review" | "approve";

interface Who { id: string; is_admin: boolean }

/** Effective access of a user to a form. Group access counts; review beats general. */
export async function formAccess(tx: Sql, user: Who | null, form: Pick<FormRow, "id" | "owner_id">): Promise<Access> {
  if (!user) return null;
  if (user.is_admin) return "admin";
  if (form.owner_id === user.id) return "owner";
  const [r] = await tx<{ a: string | null }[]>`
    select case when bool_or(access = 'approve') then 'approve' when bool_or(access = 'review') then 'review' when bool_or(access = 'general') then 'general' end as a
    from form_access fa
    where fa.form_id = ${form.id} and (fa.user_id = ${user.id}
      or fa.group_id in (select group_id from group_members where user_id = ${user.id}))`;
  return (r?.a as Access) ?? null;
}

export const canReview = (a: Access) => a === "admin" || a === "owner" || a === "review" || a === "approve";
/** May act on an approval assigned to them (explicit Approval access on the form). */
export const canApprove = (a: Access) => a === "approve";
export const canEditForm = (a: Access) => a === "admin" || a === "owner";

/** Can this person submit the form (null user = anonymous public requester)? */
export function canSubmit(form: Pick<FormRow, "visibility">, user: Who | null, access: Access) {
  if (form.visibility === "public") return true;
  if (!user) return false;
  if (form.visibility === "all_users") return true;
  return access !== null;
}

/** Users who may be chosen as approvers: explicit Approval access (directly or via a group). */
export async function approverIds(tx: Sql, formId: string): Promise<Set<string>> {
  const rows = await tx<{ id: string }[]>`
    select fa.user_id as id from form_access fa where fa.form_id = ${formId} and fa.access = 'approve' and fa.user_id is not null
    union
    select gm.user_id from form_access fa join group_members gm on gm.group_id = fa.group_id
    where fa.form_id = ${formId} and fa.access = 'approve'`;
  return new Set(rows.map((r) => r.id));
}
