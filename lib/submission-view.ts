import type { Sql } from "./db";
import type { FormRow, SubmissionRow } from "./types";

export interface Detail {
  sub: SubmissionRow & { submitter: string | null };
  form: FormRow;
  approvals: { id: string; level: number; step_name: string; version: number; approver: string; decision: string; comment: string | null; closed_note: string | null; decided_at: Date | null; created_at: Date }[];
  audit: { actor: string; action: string; detail: Record<string, unknown>; created_at: Date }[];
  versions: { version: number; data: Record<string, unknown>; created_at: Date }[];
  steps: { level: number; name: string }[];
}

export async function loadDetail(tx: Sql, submissionId: string): Promise<Detail | null> {
  const [sub] = await tx<(SubmissionRow & { submitter: string | null })[]>`
    select s.*, coalesce(u.name, s.submitter_name, s.submitter_email, 'Public requester') as submitter
    from submissions s left join users u on u.id = s.submitter_id where s.id = ${submissionId}`;
  if (!sub) return null;
  const [form] = await tx<FormRow[]>`select * from forms where id = ${sub.form_id}`;
  if (!form) return null;
  const approvals = await tx<Detail["approvals"]>`
    select a.id, a.level, a.step_name, a.version, u.name as approver, a.decision, a.comment, a.closed_note, a.decided_at, a.created_at
    from approvals a join users u on u.id = a.approver_user_id where a.submission_id = ${sub.id} order by a.version, a.level, a.created_at`;
  const audit = await tx<Detail["audit"]>`select actor, action, detail, created_at from audit_log where submission_id = ${sub.id} order by created_at, id`;
  const versions = await tx<Detail["versions"]>`select version, data, created_at from submission_versions where submission_id = ${sub.id} order by version`;
  const steps = await tx<Detail["steps"]>`select level, name from approval_steps where form_id = ${form.id} order by level`;
  return { sub, form, approvals, audit, versions, steps };
}
