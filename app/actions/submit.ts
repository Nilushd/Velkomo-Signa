"use server";
import { rootSql, tenant } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";
import { formAccess, canSubmit, canReview } from "@/lib/access";
import { validateAnswers, fileIdsIn } from "@/lib/validate";
import { submit, resubmit, withdraw, decide, resolveActionToken } from "@/lib/approvals";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyCaptcha } from "@/lib/captcha";
import { sha256 } from "@/lib/crypto";
import type { Field, FormRow, SubmissionRow } from "@/lib/types";

type Res = { ok: true; refNo: string; status: string; statusToken?: string; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function filesBelong(form: FormRow, data: Record<string, unknown>) {
  const ids = fileIdsIn(form.schema, data);
  if (!ids.length) return true;
  const rows = await rootSql()`select id from files where id in ${rootSql()(ids)} and form_id = ${form.id}`;
  return rows.length === ids.length;
}

function guessName(schema: Field[], data: Record<string, unknown>) {
  const f = schema.find((x) => x.type === "text" && /name/i.test(x.label));
  return f && data[f.id] ? String(data[f.id]).slice(0, 120) : null;
}
function guessEmail(schema: Field[], data: Record<string, unknown>) {
  const f = schema.find((x) => x.type === "email");
  return f && data[f.id] ? String(data[f.id]) : null;
}

export async function submitForm(code: string, raw: Record<string, unknown>, captcha?: string | null): Promise<Res> {
  const [form] = await rootSql()<FormRow[]>`select * from forms where short_code = ${code}`;
  if (!form || form.status !== "published") return { ok: false, error: "This form is not accepting submissions." };
  const s = await getSession();
  const user: SessionUser | null = s && s.property_id === form.property_id && !s.must_change_password ? s : null;
  const access = await tenant({ propertyId: form.property_id, userId: null }, (tx) => formAccess(tx, user, form));
  if (!canSubmit(form, user, access)) return { ok: false, error: "You don't have access to this form." };
  if (!user) {
    if (!(await rateLimit(`submit:${await clientIp()}`, 20, 3600))) return { ok: false, error: "Too many submissions from your network. Please try again later." };
    if (!(await verifyCaptcha(captcha))) return { ok: false, error: "Please complete the captcha." };
  }
  const v = validateAnswers(form.schema, raw);
  if (!v.ok) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: v.errors };
  if (!(await filesBelong(form, v.data))) return { ok: false, error: "An attached file is invalid. Please upload it again." };
  const r = await submit(form, v.data, {
    userId: user?.id ?? null,
    name: user?.name ?? guessName(form.schema, v.data),
    email: user?.email ?? guessEmail(form.schema, v.data),
  });
  if (!r.ok) return r;
  return { ok: true, refNo: r.refNo, status: r.status, statusToken: user ? undefined : r.statusToken, id: r.id };
}

/** Public requester (no account) resubmits through the status link. */
export async function resubmitByToken(token: string, raw: Record<string, unknown>): Promise<Res> {
  const [t] = await rootSql()<{ submission_id: string; property_id: string }[]>`select submission_id, property_id from status_tokens where token_hash = ${sha256(token)}`;
  if (!t) return { ok: false, error: "This link is not valid." };
  const [sub] = await rootSql()<SubmissionRow[]>`select * from submissions where id = ${t.submission_id}`;
  const [form] = await rootSql()<FormRow[]>`select * from forms where id = ${sub.form_id}`;
  const v = validateAnswers(form.schema, raw);
  if (!v.ok) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: v.errors };
  if (!(await filesBelong(form, v.data))) return { ok: false, error: "An attached file is invalid. Please upload it again." };
  const r = await resubmit(t.property_id, sub.id, v.data, { statusToken: token }, sub.submitter_name || sub.submitter_email || "Public requester");
  return r.ok ? { ok: true, refNo: sub.ref_no, status: r.status } : r;
}

export async function resubmitAsUser(submissionId: string, raw: Record<string, unknown>): Promise<Res> {
  const u = await getSession();
  if (!u) return { ok: false, error: "Please sign in again." };
  const [sub] = await rootSql()<SubmissionRow[]>`select * from submissions where id = ${submissionId} and property_id = ${u.property_id}`;
  if (!sub) return { ok: false, error: "Request not found." };
  const [form] = await rootSql()<FormRow[]>`select * from forms where id = ${sub.form_id}`;
  const v = validateAnswers(form.schema, raw);
  if (!v.ok) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: v.errors };
  if (!(await filesBelong(form, v.data))) return { ok: false, error: "An attached file is invalid. Please upload it again." };
  const r = await resubmit(u.property_id, sub.id, v.data, { userId: u.id }, u.name);
  return r.ok ? { ok: true, refNo: sub.ref_no, status: r.status } : r;
}

export async function withdrawRequest(submissionId: string, token?: string) {
  if (token) {
    const [t] = await rootSql()<{ submission_id: string; property_id: string }[]>`select submission_id, property_id from status_tokens where token_hash = ${sha256(token)}`;
    if (!t || t.submission_id !== submissionId) return { ok: false as const, error: "This link is not valid." };
    return withdraw(t.property_id, submissionId, { statusToken: token }, "Public requester");
  }
  const u = await getSession();
  if (!u) return { ok: false as const, error: "Please sign in again." };
  return withdraw(u.property_id, submissionId, { userId: u.id }, u.name);
}

/** In-app decision: the approval row must belong to the signed-in user, and they must still have Review access. */
export async function decideInApp(approvalId: string, decision: "approved" | "rejected", comment: string) {
  const u = await getSession();
  if (!u || u.must_change_password) return { ok: false as const, error: "Please sign in again." };
  const [a] = await rootSql()<{ approver_user_id: string; form_id: string; owner_id: string | null; property_id: string }[]>`
    select a.approver_user_id, s.form_id, f.owner_id, a.property_id from approvals a join submissions s on s.id = a.submission_id join forms f on f.id = s.form_id
    where a.id = ${approvalId}`;
  if (!a || a.property_id !== u.property_id || a.approver_user_id !== u.id) return { ok: false as const, error: "This approval isn't assigned to you." };
  const acc = await tenant({ propertyId: u.property_id, userId: null }, (tx) => formAccess(tx, { id: u.id, is_admin: false }, { id: a.form_id, owner_id: null }));
  if (!canReview(acc)) return { ok: false as const, error: "You no longer have Review access to this form." };
  return decide(u.property_id, approvalId, decision, comment, { userId: u.id, name: u.name, via: "app" });
}

/** E-mail decision via the signed, single-use link. No login. */
export async function decideByToken(token: string, decision: "approved" | "rejected", comment: string) {
  if (!(await rateLimit(`token:${await clientIp()}`, 60, 3600))) return { ok: false as const, error: "Too many attempts. Try again later." };
  const t = await resolveActionToken(token);
  if (!t) return { ok: false as const, error: "This link is not valid." };
  if (t.expires_at < new Date()) return { ok: false as const, error: "This link has expired. Please open the request in the app." };
  const [ap] = await rootSql()<{ approver_user_id: string; name: string; decision: string; closed_note: string | null }[]>`
    select a.approver_user_id, u.name, a.decision, a.closed_note from approvals a join users u on u.id = a.approver_user_id where a.id = ${t.approval_id}`;
  if (t.used_at) {
    const by = ap.decision === "closed" ? (ap.closed_note ?? "").replace(/^Handled by /, "") : ap.name;
    return { ok: false as const, error: `Already handled by ${by}.` };
  }
  return decide(t.property_id, t.approval_id, decision, comment, { userId: ap.approver_user_id, name: ap.name, via: "email" });
}
