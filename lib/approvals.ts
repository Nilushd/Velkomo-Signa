/**
 * Approval engine. Sequential levels (1–5). Several approvers per level: the first to act decides.
 * All writes happen in one transaction with the submission row locked; e-mails / notifications are
 * collected as effects and sent only after commit.
 */
import { asSystemTx } from "./tx";
import type { Sql } from "./db";
import { randomToken, sha256, verifyCode } from "./crypto";
import { emailLayout } from "./email";
import { summaryRows } from "./format";
import { appUrl } from "./env";
import { approverIds } from "./access";
import { runEffects, type Effect } from "./effects";
import { coverFor } from "./delegation";
import type { FormRow, SubmissionRow } from "./types";

export const TOKEN_DAYS = 7;

interface StepRow { id: string; level: number; name: string; channel: "email" | "app" | "both"; reminder_days: number | null }
interface Ctx { tx: Sql; effects: Effect[]; propertyName: string }
export interface Actor { userId: string | null; name: string; via: "app" | "email" | "public" | "system" }

async function audit(tx: Sql, sub: Pick<SubmissionRow, "id" | "property_id" | "form_id">, actor: Actor, action: string, detail: Record<string, unknown> = {}) {
  await tx`insert into audit_log (property_id, submission_id, form_id, actor, actor_user_id, action, detail)
    values (${sub.property_id}, ${sub.id}, ${sub.form_id}, ${actor.name}, ${actor.userId}, ${action}, ${tx.json({ via: actor.via, ...detail } as never)})`;
}

async function nextRef(tx: Sql, propertyId: string) {
  const year = new Date().getFullYear();
  const [r] = await tx<{ last: number }[]>`
    insert into ref_counters (property_id, year, last) values (${propertyId}, ${year}, 1)
    on conflict (property_id, year) do update set last = ref_counters.last + 1 returning last`;
  return `REQ-${year}-${String(r.last).padStart(4, "0")}`;
}

export async function newStatusToken(tx: Sql, sub: Pick<SubmissionRow, "id" | "property_id">) {
  const token = randomToken();
  await tx`insert into status_tokens (property_id, submission_id, token_hash) values (${sub.property_id}, ${sub.id}, ${sha256(token)})`;
  return token;
}

async function loadSteps(tx: Sql, formId: string) {
  return tx<StepRow[]>`select id, level, name, channel, reminder_days from approval_steps where form_id = ${formId} order by level`;
}

/** Users of a level (groups expanded), active, and still holding Approval access on the form. */
async function levelApprovers(tx: Sql, stepId: string, formId: string) {
  const rows = await tx<{ id: string; name: string; email: string | null }[]>`
    select distinct u.id, u.name, u.email from users u
    where u.active and u.id in (
      select user_id from approval_step_approvers where step_id = ${stepId} and user_id is not null
      union
      select gm.user_id from approval_step_approvers sa join group_members gm on gm.group_id = sa.group_id
      where sa.step_id = ${stepId})`;
  const allowed = await approverIds(tx, formId);
  return rows.filter((r) => allowed.has(r.id));
}

export async function approvalEmail(ctx: { propertyName: string; propertyId: string }, opts: {
  to: string; form: Pick<FormRow, "title" | "schema">; sub: Pick<SubmissionRow, "ref_no" | "data" | "submitter_name" | "version">;
  stepName: string; token: string; reminder?: boolean; onBehalfOf?: string;
}) {
  const base = `${appUrl()}/a/${opts.token}`;
  return {
    to: opts.to,
    propertyId: ctx.propertyId,
    subject: `${opts.reminder ? "Reminder: " : ""}Approval needed: ${opts.form.title} (${opts.sub.ref_no})${opts.onBehalfOf ? ` — for ${opts.onBehalfOf}` : ""}`,
    html: emailLayout({
      propertyName: ctx.propertyName,
      title: `${opts.reminder ? "Reminder — " : ""}${opts.form.title} needs your approval`,
      intro: `${opts.onBehalfOf ? `You're covering for ${opts.onBehalfOf} while they are away. ` : ""}${opts.sub.submitter_name || "A requester"} submitted ${opts.sub.ref_no}${opts.sub.version > 1 ? ` (version ${opts.sub.version})` : ""}. Step: ${opts.stepName}.`,
      rows: summaryRows(opts.form.schema, opts.sub.data),
      buttons: [
        { label: "Approve", url: `${base}?d=approve`, color: "#047857" },
        { label: "Reject", url: `${base}?d=reject`, color: "#D92D20" },
        { label: "View details", url: base, color: "#2563EB" },
      ],
      footer: `This link works once, needs no login and expires in ${TOKEN_DAYS} days. If several people approve this step, the first to act decides.`,
    }),
  };
}

async function startLevel(ctx: Ctx, form: FormRow, sub: SubmissionRow, level: number, steps: StepRow[]): Promise<void> {
  const { tx } = ctx;
  const step = steps.find((s) => s.level >= level);
  if (!step) return finalizeApproved(ctx, form, sub);
  const people = await levelApprovers(tx, step.id, form.id);
  await tx`update submissions set current_level = ${step.level}, updated_at = now() where id = ${sub.id}`;
  sub.current_level = step.level;
  if (people.length === 0) {
    await audit(tx, sub, { userId: null, name: "System", via: "system" }, "level_skipped", { level: step.level, step: step.name, reason: "no approvers with Approval access" });
    return startLevel(ctx, form, sub, step.level + 1, steps);
  }
  // out of office: send to whoever is covering; one row per person even if they cover for several
  const targets: { id: string; name: string; email: string | null; forId: string | null; forName: string | null; delegationId: string | null }[] = [];
  for (const p of people) {
    const c = await coverFor(tx, p.id);
    const t = c ? { id: c.userId, name: c.name, email: c.email, forId: p.id, forName: p.name, delegationId: c.delegationId } : { ...p, forId: null, forName: null, delegationId: null };
    if (!targets.some((x) => x.id === t.id)) targets.push(t);
  }
  for (const p of targets) {
    const [ap] = await tx<{ id: string }[]>`
      insert into approvals (property_id, submission_id, level, step_name, version, approver_user_id, on_behalf_of, delegation_id)
      values (${sub.property_id}, ${sub.id}, ${step.level}, ${step.name}, ${sub.version}, ${p.id}, ${p.forId}, ${p.delegationId}) returning id`;
    const wantsEmail = step.channel !== "app" && !!p.email;
    const wantsApp = step.channel !== "email" || !p.email; // fall back to the app if the user has no e-mail
    if (wantsEmail) {
      const token = randomToken();
      await tx`insert into action_tokens (property_id, approval_id, token_hash, expires_at)
        values (${sub.property_id}, ${ap.id}, ${sha256(token)}, now() + make_interval(days => ${TOKEN_DAYS}))`;
      ctx.effects.push({ kind: "email", mail: await approvalEmail({ propertyName: ctx.propertyName, propertyId: sub.property_id }, { to: p.email!, form, sub, stepName: step.name, token, onBehalfOf: p.forName ?? undefined }) });
    }
    if (wantsApp) {
      ctx.effects.push({ kind: "notify", propertyId: sub.property_id, userId: p.id, push: true,
        title: `Approval needed: ${form.title}${p.forName ? ` (for ${p.forName})` : ""}`, body: `${sub.ref_no} · ${step.name}`, url: `/approvals/${ap.id}` });
    }
  }
  await audit(tx, sub, { userId: null, name: "System", via: "system" }, "level_started",
    { level: step.level, step: step.name, approvers: targets.map((p) => (p.forName ? `${p.name} (for ${p.forName})` : p.name)), channel: step.channel });
}

async function finalizeApproved(ctx: Ctx, form: FormRow, sub: SubmissionRow) {
  await ctx.tx`update submissions set status = 'approved', updated_at = now() where id = ${sub.id}`;
  sub.status = "approved";
  await audit(ctx.tx, sub, { userId: null, name: "System", via: "system" }, "approved", { version: sub.version });
  await notifyRequester(ctx, form, sub, "approved");
}

async function notifyRequester(ctx: Ctx, form: FormRow, sub: SubmissionRow, kind: "approved" | "rejected" | "received", comment?: string) {
  const { tx } = ctx;
  const titles = {
    approved: `Approved: ${form.title} (${sub.ref_no})`,
    rejected: `Changes needed: ${form.title} (${sub.ref_no})`,
    received: `Received: ${form.title} (${sub.ref_no})`,
  };
  const intros = {
    approved: "Your request has been approved.",
    rejected: `Your request was rejected${comment ? ` with this comment: “${comment}”` : ""}. You can edit your answers and resubmit, or withdraw it.`,
    received: sub.status === "approved" ? "Your request was received and accepted." : "Your request was received and is waiting for approval. We'll e-mail you when it is decided.",
  };
  let email = sub.submitter_email;
  let url: string;
  if (sub.submitter_id) {
    url = `${appUrl()}/requests/${sub.id}`;
    const [u] = await tx<{ email: string | null }[]>`select email from users where id = ${sub.submitter_id}`;
    email = u?.email ?? email;
    if (kind !== "received") {
      ctx.effects.push({ kind: "notify", propertyId: sub.property_id, userId: sub.submitter_id, push: true,
        title: titles[kind], body: kind === "rejected" && comment ? comment : intros[kind], url: `/requests/${sub.id}` });
    }
  } else {
    url = `${appUrl()}/s/${await newStatusToken(tx, sub)}`;
  }
  if (email) {
    ctx.effects.push({ kind: "email", mail: {
      to: email, propertyId: sub.property_id, subject: titles[kind],
      html: emailLayout({
        propertyName: ctx.propertyName, title: titles[kind], intro: intros[kind],
        rows: [["Reference", sub.ref_no], ["Form", form.title], ...(kind === "received" ? summaryRows(form.schema, sub.data, 6) : [])],
        buttons: [{ label: kind === "rejected" ? "Edit and resubmit" : "View status", url }],
        footer: kind === "received" ? "Keep this e-mail: the link shows the status of your request." : undefined,
      }),
    } });
  }
}

async function loadCtx(tx: Sql, propertyId: string): Promise<Ctx> {
  const [p] = await tx<{ name: string }[]>`select name from properties where id = ${propertyId}`;
  return { tx, effects: [], propertyName: p?.name ?? "" };
}

async function loadForm(tx: Sql, formId: string) {
  const [f] = await tx<FormRow[]>`select * from forms where id = ${formId}`;
  return f;
}

// ---------------------------------------------------------------------------------------------
export type SubmitResult = { ok: true; id: string; refNo: string; status: string; statusToken: string } | { ok: false; error: string };

export async function submit(form: FormRow, data: Record<string, unknown>, who: { userId: string | null; name: string | null; email: string | null }): Promise<SubmitResult> {
  let effects: Effect[] = [];
  const res = await asSystemTx(form.property_id, async (tx): Promise<SubmitResult> => {
    const [f] = await tx<FormRow[]>`select * from forms where id = ${form.id} for update`;
    if (!f || f.status !== "published") return { ok: false, error: "This form is not accepting submissions." };
    if (f.closes_at && f.closes_at < new Date()) return { ok: false, error: "This form is closed." };
    if (f.max_submissions) {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from submissions where form_id = ${f.id}`;
      if (n >= f.max_submissions) return { ok: false, error: "This form has reached its submission limit." };
    }
    const ctx = await loadCtx(tx, f.property_id);
    const ref = await nextRef(tx, f.property_id);
    const [sub] = await tx<SubmissionRow[]>`
      insert into submissions (property_id, form_id, ref_no, data, submitter_id, submitter_email, submitter_name, status, current_level, verify_code)
      values (${f.property_id}, ${f.id}, ${ref}, ${tx.json(data as never)}, ${who.userId}, ${who.email}, ${who.name}, 'pending', 1, ${verifyCode()})
      returning *`;
    const token = await newStatusToken(tx, sub);
    const actor: Actor = { userId: who.userId, name: who.name || who.email || "Public requester", via: who.userId ? "app" : "public" };
    await audit(tx, sub, actor, "submitted", { version: 1 });
    const steps = await loadSteps(tx, f.id);
    if (steps.length === 0) await finalizeApproved(ctx, f, sub);
    else await startLevel(ctx, f, sub, 1, steps);
    await notifyRequester(ctx, f, sub, "received");
    effects = ctx.effects;
    return { ok: true, id: sub.id, refNo: ref, status: sub.status, statusToken: token };
  });
  await runEffects(effects);
  return res;
}

export type DecideResult = { ok: true; status: string } | { ok: false; error: string; handledBy?: string };

/** First decision at a level wins. `approvalId` must already be verified to belong to the actor (app) or the token (email). */
export async function decide(propertyId: string, approvalId: string, decision: "approved" | "rejected", comment: string | null, actor: Actor): Promise<DecideResult> {
  comment = comment?.trim() || null;
  if (decision === "rejected" && !comment) return { ok: false, error: "A comment is required to reject." };
  let effects: Effect[] = [];
  const res = await asSystemTx(propertyId, async (tx): Promise<DecideResult> => {
    const [a0] = await tx<{ submission_id: string }[]>`select submission_id from approvals where id = ${approvalId}`;
    if (!a0) return { ok: false, error: "Approval not found." };
    // lock the submission: concurrent approvers on the same level queue up here
    const [sub] = await tx<SubmissionRow[]>`select * from submissions where id = ${a0.submission_id} for update`;
    const [ap] = await tx<{ id: string; level: number; version: number; decision: string; closed_note: string | null; approver_user_id: string; step_name: string; for_name: string | null }[]>`
      select a.*, ob.name as for_name from approvals a left join users ob on ob.id = a.on_behalf_of where a.id = ${approvalId}`;
    if (ap.decision !== "pending") {
      const by = ap.decision === "closed" ? (ap.closed_note ?? "").replace(/^Handled by /, "") : "you";
      return { ok: false, error: `Already handled by ${by}.`, handledBy: by };
    }
    if (sub.status !== "pending" || sub.version !== ap.version || sub.current_level !== ap.level) {
      await tx`update approvals set decision = 'closed', closed_note = 'Request no longer pending' where id = ${ap.id}`;
      return { ok: false, error: "This request is no longer waiting for this decision." };
    }
    const ctx = await loadCtx(tx, propertyId);
    const form = await loadForm(tx, sub.form_id);
    if (ap.for_name) actor = { ...actor, name: `${actor.name} (for ${ap.for_name})` };
    await tx`update approvals set decision = ${decision}, comment = ${comment}, decided_at = now() where id = ${ap.id}`;
    await tx`update approvals set decision = 'closed', closed_note = ${"Handled by " + actor.name}, decided_at = now()
      where submission_id = ${sub.id} and level = ${ap.level} and version = ${ap.version} and decision = 'pending'`;
    await tx`update action_tokens set used_at = now() where used_at is null and approval_id in (
      select id from approvals where submission_id = ${sub.id} and level = ${ap.level} and version = ${ap.version})`;
    await audit(tx, sub, actor, decision === "approved" ? "level_approved" : "level_rejected", { level: ap.level, step: ap.step_name, comment, version: sub.version });
    if (decision === "approved") {
      const steps = await loadSteps(tx, form.id);
      await startLevel(ctx, form, sub, ap.level + 1, steps);
    } else {
      await tx`update submissions set status = 'rejected', updated_at = now() where id = ${sub.id}`;
      sub.status = "rejected";
      await notifyRequester(ctx, form, sub, "rejected", comment ?? undefined);
    }
    effects = ctx.effects;
    return { ok: true, status: sub.status };
  });
  await runEffects(effects);
  return res;
}

export type Requester = { userId: string } | { statusToken: string };

async function checkRequester(tx: Sql, sub: SubmissionRow, who: Requester) {
  if ("userId" in who) return !!sub.submitter_id && sub.submitter_id === who.userId;
  if (sub.submitter_id) return false; // account holders resubmit from inside the app
  const [t] = await tx`select 1 from status_tokens where submission_id = ${sub.id} and token_hash = ${sha256(who.statusToken)}`;
  return !!t;
}

/** Only the original submitter. Old answers go to submission_versions; the request restarts at level 1. */
export async function resubmit(propertyId: string, submissionId: string, data: Record<string, unknown>, who: Requester, actorName: string):
  Promise<{ ok: true; version: number; status: string } | { ok: false; error: string }> {
  let effects: Effect[] = [];
  const res = await asSystemTx(propertyId, async (tx) => {
    const [sub] = await tx<SubmissionRow[]>`select * from submissions where id = ${submissionId} for update`;
    if (!sub || !(await checkRequester(tx, sub, who))) return { ok: false as const, error: "Only the original requester can resubmit." };
    if (sub.status !== "rejected") return { ok: false as const, error: "Only rejected requests can be edited and resubmitted." };
    const ctx = await loadCtx(tx, propertyId);
    const form = await loadForm(tx, sub.form_id);
    await tx`insert into submission_versions (property_id, submission_id, version, data, created_at)
      values (${sub.property_id}, ${sub.id}, ${sub.version}, ${tx.json(sub.data as never)}, ${sub.updated_at})`;
    const [upd] = await tx<SubmissionRow[]>`update submissions set data = ${tx.json(data as never)}, version = version + 1,
      status = 'pending', current_level = 1, updated_at = now() where id = ${sub.id} returning *`;
    await audit(tx, upd, { userId: "userId" in who ? who.userId : null, name: actorName, via: "userId" in who ? "app" : "public" }, "resubmitted", { version: upd.version });
    const steps = await loadSteps(tx, form.id);
    if (steps.length === 0) await finalizeApproved(ctx, form, upd);
    else await startLevel(ctx, form, upd, 1, steps);
    effects = ctx.effects;
    return { ok: true as const, version: upd.version, status: upd.status };
  });
  await runEffects(effects);
  return res;
}

export async function withdraw(propertyId: string, submissionId: string, who: Requester, actorName: string) {
  return asSystemTx(propertyId, async (tx) => {
    const [sub] = await tx<SubmissionRow[]>`select * from submissions where id = ${submissionId} for update`;
    if (!sub || !(await checkRequester(tx, sub, who))) return { ok: false as const, error: "Only the original requester can withdraw." };
    if (sub.status !== "rejected") return { ok: false as const, error: "Only rejected requests can be withdrawn." };
    await tx`update submissions set status = 'withdrawn', updated_at = now() where id = ${sub.id}`;
    await audit(tx, sub, { userId: "userId" in who ? who.userId : null, name: actorName, via: "userId" in who ? "app" : "public" }, "withdrawn");
    return { ok: true as const };
  });
}

/** Daily cron: remind approvers of pending approvals older than the step's reminder_days. */
export async function sendReminders(): Promise<number> {
  const { rootSql } = await import("./db");
  const sql = rootSql();
  const due = await sql<{ id: string; property_id: string; approver_user_id: string; email: string | null; channel: string; step_name: string;
    form_id: string; submission_id: string; property_name: string }[]>`
    select a.id, a.property_id, a.approver_user_id, u.email, st.channel, a.step_name, s.form_id, s.id as submission_id, p.name as property_name
    from approvals a
    join submissions s on s.id = a.submission_id and s.status = 'pending' and s.version = a.version and s.current_level = a.level
    join approval_steps st on st.form_id = s.form_id and st.level = a.level and st.reminder_days is not null
    join users u on u.id = a.approver_user_id and u.active
    join properties p on p.id = a.property_id and p.active
    where a.decision = 'pending'
      and coalesce(a.reminded_at, a.created_at) < now() - make_interval(days => st.reminder_days)`;
  const effects: Effect[] = [];
  for (const d of due) {
    await asSystemTx(d.property_id, async (tx) => {
      const form = await loadForm(tx, d.form_id);
      const [sub] = await tx<SubmissionRow[]>`select * from submissions where id = ${d.submission_id}`;
      if (d.channel !== "app" && d.email) {
        const token = randomToken();
        await tx`insert into action_tokens (property_id, approval_id, token_hash, expires_at)
          values (${d.property_id}, ${d.id}, ${sha256(token)}, now() + make_interval(days => ${TOKEN_DAYS}))`;
        effects.push({ kind: "email", mail: await approvalEmail({ propertyName: d.property_name, propertyId: d.property_id }, { to: d.email, form, sub, stepName: d.step_name, token, reminder: true }) });
      }
      if (d.channel !== "email" || !d.email) {
        effects.push({ kind: "notify", propertyId: d.property_id, userId: d.approver_user_id, push: true,
          title: `Reminder: ${form.title} is waiting for you`, body: `${sub.ref_no} · ${d.step_name}`, url: `/approvals/${d.id}` });
      }
      await tx`update approvals set reminded_at = now() where id = ${d.id}`;
    });
  }
  await runEffects(effects);
  return due.length;
}

/** Resolve an e-mail action token (no login). */
export async function resolveActionToken(token: string) {
  const { rootSql } = await import("./db");
  const [t] = await rootSql()<{ approval_id: string; property_id: string; expires_at: Date; used_at: Date | null }[]>`
    select approval_id, property_id, expires_at, used_at from action_tokens where token_hash = ${sha256(token)}`;
  return t ?? null;
}

export async function useActionToken(token: string) {
  const { rootSql } = await import("./db");
  await rootSql()`update action_tokens set used_at = now() where token_hash = ${sha256(token)} and used_at is null`;
}
