"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, asSystem } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { forwardWaiting, returnWaiting, TZ } from "@/lib/delegation";
import { runEffects, type Effect } from "@/lib/effects";

const Input = z.object({
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid({ message: "Choose who will approve for you." }),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the first day."),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the last day."),
  note: z.string().max(300).default(""),
  /** empty = all forms */
  formIds: z.array(z.string().uuid()).max(200).default([]),
});

/** Set "out of office": forward my approvals (or, for an admin, someone else's) to a colleague for some days. */
export async function createDelegation(raw: z.input<typeof Input>) {
  const u = await requireUser();
  const p = Input.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const from = p.data.fromUserId ?? u.id;
  if (from !== u.id && !u.is_admin) return { error: "Only an admin can set this for someone else." };
  if (p.data.toUserId === from) return { error: "Choose someone else to approve while you're away." };
  if (p.data.endsOn < p.data.startsOn) return { error: "The last day is before the first day." };
  const effects: Effect[] = [];
  const res = await asSystem(u.property_id, async (tx) => {
    const [today] = await tx<{ d: string }[]>`select to_char((now() at time zone ${TZ()})::date, 'YYYY-MM-DD') as d`;
    if (p.data.endsOn < today.d) return { error: "The last day is already in the past." };
    const [to] = await tx<{ name: string }[]>`select name from users where id = ${p.data.toUserId} and active`;
    if (!to) return { error: "That person isn't an active user." };
    // overlapping dates are fine for different forms; the same form (or "all forms") can't be forwarded twice
    const overlaps = await tx<{ s: string; e: string; to_name: string; forms: string[] }[]>`
      select to_char(d.starts_on, 'DD Mon') as s, to_char(d.ends_on, 'DD Mon YYYY') as e, u.name as to_name,
        coalesce(array_agg(df.form_id::text) filter (where df.form_id is not null), '{}') as forms
      from delegations d join users u on u.id = d.to_user_id left join delegation_forms df on df.delegation_id = d.id
      where d.from_user_id = ${from} and d.cancelled_at is null and d.starts_on <= ${p.data.endsOn}::date and d.ends_on >= ${p.data.startsOn}::date
      group by d.id, u.name, d.starts_on, d.ends_on`;
    const mine = new Set(p.data.formIds);
    const clash = overlaps.find((o) => o.forms.length === 0 || mine.size === 0 || o.forms.some((f) => mine.has(f)));
    if (clash) return { error: `${clash.forms.length ? "Some of these forms are" : "Approvals are"} already forwarded to ${clash.to_name} for ${clash.s} – ${clash.e}. Cancel that first, or choose other forms.` };
    if (p.data.formIds.length) {
      const ok = await tx<{ id: string }[]>`select id from forms where id in ${tx(p.data.formIds)}`;
      if (ok.length !== p.data.formIds.length) return { error: "One of the chosen forms no longer exists." };
    }
    const [d] = await tx<{ id: string }[]>`insert into delegations (property_id, from_user_id, to_user_id, starts_on, ends_on, note, created_by)
      values (${u.property_id}, ${from}, ${p.data.toUserId}, ${p.data.startsOn}, ${p.data.endsOn}, ${p.data.note}, ${u.id}) returning id`;
    for (const f of p.data.formIds) await tx`insert into delegation_forms (property_id, delegation_id, form_id) values (${u.property_id}, ${d.id}, ${f})`;
    const moved = p.data.startsOn <= today.d ? await forwardWaiting(tx, effects, d.id) : 0;
    return { ok: true as const, moved, toName: to.name, startsNow: p.data.startsOn <= today.d };
  });
  await runEffects(effects);
  revalidatePath("/settings"); revalidatePath("/approvals"); revalidatePath(`/users/${from}`);
  return res;
}

/** Cancel / end early: approvals still waiting go back to the original approver. */
export async function cancelDelegation(id: string) {
  const u = await requireUser();
  const [d] = await rootSql()<{ from_user_id: string; property_id: string }[]>`select from_user_id, property_id from delegations where id = ${id}`;
  if (!d || d.property_id !== u.property_id || (d.from_user_id !== u.id && !u.is_admin)) return { error: "Not allowed." };
  const effects: Effect[] = [];
  const back = await asSystem(u.property_id, async (tx) => {
    await tx`update delegations set cancelled_at = now() where id = ${id}`;
    return returnWaiting(tx, effects, id);
  });
  await runEffects(effects);
  revalidatePath("/settings"); revalidatePath("/approvals"); revalidatePath(`/users/${d.from_user_id}`);
  return { ok: true, back };
}

/** Stop forwarding one form of a delegation (its waiting approvals go back). Removing the last form cancels the delegation. */
export async function removeDelegationForm(id: string, formId: string) {
  const u = await requireUser();
  const [d] = await rootSql()<{ from_user_id: string; property_id: string }[]>`select from_user_id, property_id from delegations where id = ${id} and cancelled_at is null`;
  if (!d || d.property_id !== u.property_id || (d.from_user_id !== u.id && !u.is_admin)) return { error: "Not allowed." };
  const effects: Effect[] = [];
  const res = await asSystem(u.property_id, async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from delegation_forms where delegation_id = ${id}`;
    if (n === 0) return { error: "This forwarding covers all forms — cancel it instead." };
    const back = await returnWaiting(tx, effects, id, formId);
    if (n === 1) await tx`update delegations set cancelled_at = now() where id = ${id}`;
    else await tx`delete from delegation_forms where delegation_id = ${id} and form_id = ${formId}`;
    return { ok: true as const, back, cancelled: n === 1 };
  });
  await runEffects(effects);
  revalidatePath("/settings"); revalidatePath("/approvals"); revalidatePath(`/users/${d.from_user_id}`);
  return res;
}
