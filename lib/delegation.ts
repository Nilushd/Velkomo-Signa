/**
 * Out-of-office forwarding. While a delegation is active (today between starts_on and ends_on, in the hotel's
 * time zone), approvals for the away user go to the delegate instead, marked on_behalf_of. Chains are followed
 * (A → B → C) up to 3 hops; loops stop at the last person who isn't away.
 */
import type { Sql } from "./db";
import { randomToken, sha256 } from "./crypto";
import type { Effect } from "./effects";
import { TOKEN_DAYS, approvalEmail } from "./approvals";
import type { FormRow, SubmissionRow } from "./types";

export const TZ = () => process.env.NEXT_PUBLIC_TIMEZONE || "UTC";

export interface Cover { delegationId: string; userId: string; name: string; email: string | null; endsOn: string }

/** Who actually receives approvals meant for `userId` today (null = nobody is covering). */
export async function coverFor(tx: Sql, userId: string): Promise<Cover | null> {
  let cur = userId; let found: Cover | null = null;
  const seen = new Set([userId]);
  for (let hop = 0; hop < 3; hop++) {
    const [d] = await tx<{ id: string; to_user_id: string; name: string; email: string | null; ends_on: string }[]>`
      select d.id, d.to_user_id, u.name, u.email, to_char(d.ends_on, 'YYYY-MM-DD') as ends_on from delegations d join users u on u.id = d.to_user_id and u.active
      where d.from_user_id = ${cur} and d.cancelled_at is null
        and (now() at time zone ${TZ()})::date between d.starts_on and d.ends_on
      order by d.created_at desc limit 1`;
    if (!d || seen.has(d.to_user_id)) break;
    found = { delegationId: d.id, userId: d.to_user_id, name: d.name, email: d.email, endsOn: d.ends_on };
    seen.add(d.to_user_id); cur = d.to_user_id;
  }
  return found;
}

async function propName(tx: Sql, propertyId: string) {
  const [p] = await tx<{ name: string }[]>`select name from properties where id = ${propertyId}`;
  return p?.name ?? "";
}

/**
 * Move one waiting approval to a new person: old e-mail links stop working, the new person gets the e-mail/app
 * notice. If they already have this approval (same level), the moved row is closed instead.
 */
export async function reassign(tx: Sql, effects: Effect[], approvalId: string, to: { userId: string; name: string; email: string | null },
  onBehalfOf: string | null, delegationId: string | null, note: string, actorName: string) {
  const [a] = await tx<{ id: string; submission_id: string; level: number; version: number; step_name: string; property_id: string; approver_user_id: string }[]>`
    select id, submission_id, level, version, step_name, property_id, approver_user_id from approvals where id = ${approvalId} and decision = 'pending'`;
  if (!a) return;
  await tx`update action_tokens set used_at = now() where approval_id = ${a.id} and used_at is null`;
  const [dup] = await tx`select 1 from approvals where submission_id = ${a.submission_id} and level = ${a.level} and version = ${a.version}
    and approver_user_id = ${to.userId} and decision = 'pending' and id <> ${a.id}`;
  if (dup) { await tx`update approvals set decision = 'closed', closed_note = ${`Forwarded to ${to.name}, who is already an approver`} where id = ${a.id}`; return; }
  await tx`update approvals set approver_user_id = ${to.userId}, on_behalf_of = ${onBehalfOf}, delegation_id = ${delegationId} where id = ${a.id}`;
  const [sub] = await tx<SubmissionRow[]>`select * from submissions where id = ${a.submission_id}`;
  const [form] = await tx<FormRow[]>`select * from forms where id = ${sub.form_id}`;
  const [st] = await tx<{ channel: string }[]>`select channel from approval_steps where form_id = ${form.id} and level = ${a.level}`;
  const [forName] = onBehalfOf ? await tx<{ name: string }[]>`select name from users where id = ${onBehalfOf}` : [];
  const channel = st?.channel ?? "both";
  if (channel !== "app" && to.email) {
    const token = randomToken();
    await tx`insert into action_tokens (property_id, approval_id, token_hash, expires_at) values (${a.property_id}, ${a.id}, ${sha256(token)}, now() + make_interval(days => ${TOKEN_DAYS}))`;
    effects.push({ kind: "email", mail: await approvalEmail({ propertyName: await propName(tx, a.property_id), propertyId: a.property_id },
      { to: to.email, form, sub, stepName: a.step_name, token, onBehalfOf: forName?.name }) });
  }
  if (channel !== "email" || !to.email) {
    effects.push({ kind: "notify", propertyId: a.property_id, userId: to.userId, push: true,
      title: `Approval needed: ${form.title}${forName ? ` (for ${forName.name})` : ""}`, body: `${sub.ref_no} · ${a.step_name}`, url: `/approvals/${a.id}` });
  }
  await tx`insert into audit_log (property_id, submission_id, form_id, actor, actor_user_id, action, detail)
    values (${a.property_id}, ${a.submission_id}, ${form.id}, ${actorName}, null, 'forwarded', ${tx.json({ level: a.level, step: a.step_name, to: to.name, note } as never)})`;
}

/** Forward every approval still waiting on `fromUserId` to the delegate (when a delegation starts). */
export async function forwardWaiting(tx: Sql, effects: Effect[], delegationId: string) {
  const [d] = await tx<{ id: string; from_user_id: string; ends_on: string; from_name: string }[]>`
    select d.id, d.from_user_id, to_char(d.ends_on, 'DD Mon YYYY') as ends_on, u.name as from_name from delegations d join users u on u.id = d.from_user_id where d.id = ${delegationId}`;
  const cover = await coverFor(tx, d.from_user_id);
  if (!cover) return 0;
  const waiting = await tx<{ id: string }[]>`
    select a.id from approvals a join submissions s on s.id = a.submission_id
    where a.approver_user_id = ${d.from_user_id} and a.decision = 'pending' and s.status = 'pending' and s.version = a.version and s.current_level = a.level`;
  for (const w of waiting) await reassign(tx, effects, w.id, cover, d.from_user_id, cover.delegationId, `${d.from_name} is away until ${d.ends_on}`, "System");
  await tx`update delegations set applied_at = now() where id = ${delegationId}`;
  return waiting.length;
}

/** Give back approvals that were forwarded under a delegation and are still waiting (when it is cancelled). */
export async function returnWaiting(tx: Sql, effects: Effect[], delegationId: string) {
  const rows = await tx<{ id: string; on_behalf_of: string; name: string; email: string | null }[]>`
    select a.id, a.on_behalf_of, u.name, u.email from approvals a join submissions s on s.id = a.submission_id join users u on u.id = a.on_behalf_of
    where a.delegation_id = ${delegationId} and a.decision = 'pending' and s.status = 'pending' and s.version = a.version and s.current_level = a.level`;
  for (const r of rows) await reassign(tx, effects, r.id, { userId: r.on_behalf_of, name: r.name, email: r.email }, null, null, `${r.name} is back`, "System");
  return rows.length;
}

/** Daily cron: start delegations whose first day has come (move what's already waiting). */
export async function applyDueDelegations(): Promise<number> {
  const { rootSql } = await import("./db");
  const { asSystemTx } = await import("./tx");
  const { runEffects } = await import("./effects");
  const due = await rootSql()<{ id: string; property_id: string }[]>`
    select id, property_id from delegations where applied_at is null and cancelled_at is null
      and (now() at time zone ${TZ()})::date between starts_on and ends_on`;
  const effects: Effect[] = [];
  for (const d of due) await asSystemTx(d.property_id, (tx) => forwardWaiting(tx, effects, d.id));
  await runEffects(effects);
  return due.length;
}

export interface DelegationRow { id: string; other: string; starts_on: string; ends_on: string; note: string; active: boolean }

/** Current and upcoming delegations for a user: whom they forward to, and whom they cover for. */
export async function loadDelegations(tx: Sql, userId: string) {
  const q = (dir: "from" | "to") => tx<DelegationRow[]>`
    select d.id, u.name as other, to_char(d.starts_on, 'DD Mon YYYY') as starts_on, to_char(d.ends_on, 'DD Mon YYYY') as ends_on, d.note,
      (now() at time zone ${TZ()})::date between d.starts_on and d.ends_on as active
    from delegations d join users u on u.id = ${dir === "from" ? tx`d.to_user_id` : tx`d.from_user_id`}
    where ${dir === "from" ? tx`d.from_user_id` : tx`d.to_user_id`} = ${userId} and d.cancelled_at is null
      and d.ends_on >= (now() at time zone ${TZ()})::date
    order by d.starts_on`;
  return { forwarding: await q("from"), covering: await q("to") };
}
