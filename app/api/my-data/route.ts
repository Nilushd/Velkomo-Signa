import { NextResponse } from "next/server";
import { getSession, asUser } from "@/lib/auth";
import { rootSql } from "@/lib/db";

/**
 * "Download a copy of my data" — everything Velkomo Signa holds about the signed-in person in this organisation,
 * as one JSON file (right of access / data portability). Attachments are listed by name; each can be downloaded
 * from the request itself.
 */
export async function GET() {
  const u = await getSession();
  if (!u || u.must_change_password) return new NextResponse("Unauthorized", { status: 401 });
  const data = await asUser(u, async (tx) => {
    const [profile] = await tx`select username, name, email, department, is_admin, can_build_forms, email_approvals, active, created_at,
      (totp_enabled_at is not null) as two_factor_on from users where id = ${u.id}`;
    const requests = await tx`select s.ref_no, f.title as form, s.status, s.version, s.data as answers, s.created_at, s.updated_at, s.consent_at, s.consent_version
      from submissions s join forms f on f.id = s.form_id where s.submitter_id = ${u.id} order by s.created_at`;
    const decisions = await tx`select s.ref_no, a.level, a.step_name, a.decision, a.comment, a.decided_at
      from approvals a join submissions s on s.id = a.submission_id where a.approver_user_id = ${u.id} and a.decision in ('approved','rejected') order by a.decided_at`;
    const notifications = await tx`select title, body, created_at, read_at from notifications where user_id = ${u.id} order by created_at desc limit 500`;
    const privacyRequests = await tx`select kind, details, status, response, created_at, resolved_at from privacy_requests where user_id = ${u.id} order by created_at`;
    return { profile, requests, decisions, notifications, privacyRequests };
  });
  const signIns = await rootSql()`select at, ip_prefix, user_agent, method from login_events where user_id = ${u.id} order by at desc limit 200`;
  const body = JSON.stringify({ exported_at: new Date().toISOString(), organisation: u.property_name, ...data, signIns }, null, 2);
  return new NextResponse(body, { headers: { "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="velkomo-signa-my-data-${u.username}.json"`, "Cache-Control": "no-store" } });
}
