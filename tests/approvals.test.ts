/**
 * Approval engine tests. Needs DATABASE_URL pointing at a migrated + seeded database (npm run db:migrate && npm run db:seed).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rootSql, tenant } from "@/lib/db";
import { submit, decide, resubmit, withdraw, deleteRequest, resolveActionToken } from "@/lib/approvals";
import { formAccess, canSubmit, canReview, canApprove } from "@/lib/access";
import type { FormRow } from "@/lib/types";
import { randomToken, sha256 } from "@/lib/crypto";

const sql = rootSql();
let pid = "", pid2 = "";
let form: FormRow;
const U: Record<string, { id: string; name: string; is_admin: boolean }> = {};
const data = { f_name: "John Silva", f_type: "Annual", f_from: "2026-12-01", f_to: "2026-12-03", f_days: 3 };

async function pending(subId: string) {
  return sql<{ id: string; level: number; approver_user_id: string; decision: string; version: number }[]>`
    select id, level, approver_user_id, decision, version from approvals where submission_id = ${subId} order by created_at`;
}

beforeAll(async () => {
  [{ id: pid }] = await sql`select id from properties where property_code = 'HTL01'`;
  [{ id: pid2 }] = await sql`select id from properties where property_code = 'HTL02'`;
  for (const u of await sql<{ id: string; username: string; name: string; is_admin: boolean }[]>`select id, username, name, is_admin from users where property_id = ${pid}`) U[u.username] = u;
  [form] = await sql<FormRow[]>`select * from forms where property_id = ${pid} and title = 'Leave Request'`;
});
afterAll(async () => { await sql.end(); });

describe("approval engine", () => {
  it("approve path: level 1 (2 approvers) -> level 2 -> approved", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.refNo).toMatch(/^REQ-\d{4}-\d{4}$/);
    let ap = await pending(r.id);
    expect(ap.map((a) => a.approver_user_id).sort()).toEqual([U.manager.id, U.supervisor.id].sort());
    const mine = ap.find((a) => a.approver_user_id === U.manager.id)!;
    expect((await decide(pid, mine.id, "approved", null, { userId: U.manager.id, name: U.manager.name, via: "app" })).ok).toBe(true);
    ap = await pending(r.id);
    expect(ap.find((a) => a.approver_user_id === U.supervisor.id)!.decision).toBe("closed");
    const l2 = ap.filter((a) => a.level === 2);
    expect(l2.map((a) => a.approver_user_id)).toEqual([U.admin.id]);
    const res = await decide(pid, l2[0].id, "approved", "ok", { userId: U.admin.id, name: U.admin.name, via: "app" });
    expect(res).toEqual({ ok: true, status: "approved" });
    const [s] = await sql`select status from submissions where id = ${r.id}`;
    expect(s.status).toBe("approved");
    const log = await sql`select action from audit_log where submission_id = ${r.id} order by created_at`;
    expect(log.map((l) => l.action)).toContain("approved");
  });

  it("two approvers on one level: first wins, second sees 'already handled'", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const ap = await pending(r.id);
    const a1 = ap.find((a) => a.approver_user_id === U.supervisor.id)!;
    const a2 = ap.find((a) => a.approver_user_id === U.manager.id)!;
    // race both at once; exactly one must win
    const [x, y] = await Promise.all([
      decide(pid, a1.id, "approved", null, { userId: U.supervisor.id, name: U.supervisor.name, via: "app" }),
      decide(pid, a2.id, "approved", null, { userId: U.manager.id, name: U.manager.name, via: "email" }),
    ]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
    const loser = x.ok ? y : x;
    expect(!loser.ok && loser.error).toMatch(/Already handled by/);
    expect((await pending(r.id)).filter((a) => a.level === 2)).toHaveLength(1);
  });

  it("reject -> edit -> resubmit restarts at level 1 as version 2", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const a = (await pending(r.id))[0];
    expect((await decide(pid, a.id, "rejected", "  ", { userId: a.approver_user_id, name: "x", via: "app" })).ok).toBe(false); // comment required
    expect((await decide(pid, a.id, "rejected", "Wrong dates", { userId: a.approver_user_id, name: "Approver", via: "app" })).ok).toBe(true);
    // somebody else may not resubmit
    expect((await resubmit(pid, r.id, data, { userId: U.ravi.id }, "Ravi")).ok).toBe(false);
    const rs = await resubmit(pid, r.id, { ...data, f_days: 2 }, { userId: U.john.id }, U.john.name);
    expect(rs).toEqual({ ok: true, version: 2, status: "pending" });
    const [s] = await sql`select version, current_level, status, ref_no from submissions where id = ${r.id}`;
    expect(s).toMatchObject({ version: 2, current_level: 1, status: "pending", ref_no: r.refNo });
    const v = await sql`select version, data from submission_versions where submission_id = ${r.id}`;
    expect(v).toHaveLength(1);
    expect(v[0].data.f_days).toBe(3);
    const ap = await pending(r.id);
    expect(ap.filter((x) => x.version === 2 && x.level === 1 && x.decision === "pending")).toHaveLength(2);
  });

  it("cancel works before any approver acts; not after; approvers' tasks close", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    expect((await withdraw(pid, r.id, { userId: U.ravi.id }, "Ravi")).ok).toBe(false); // not his
    expect((await withdraw(pid, r.id, { userId: U.john.id }, "John")).ok).toBe(true);
    const [s1] = await sql`select status from submissions where id = ${r.id}`;
    expect(s1.status).toBe("withdrawn");
    expect((await pending(r.id)).every((a) => a.decision === "closed")).toBe(true);
    // once level 1 has approved, it can't be cancelled or deleted
    const r2 = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r2.ok) throw new Error(r2.error);
    const a = (await pending(r2.id))[0];
    await decide(pid, a.id, "approved", null, { userId: a.approver_user_id, name: "A", via: "app" });
    expect((await withdraw(pid, r2.id, { userId: U.john.id }, "John")).ok).toBe(false);
    expect((await deleteRequest(pid, r2.id, { adminId: U.admin.id }, "Admin")).ok).toBe(false);
  });

  it("a rejected request can be deleted by its submitter or an admin, leaving an audit note", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const a = (await pending(r.id))[0];
    await decide(pid, a.id, "rejected", "No", { userId: a.approver_user_id, name: "A", via: "app" });
    expect((await deleteRequest(pid, r.id, { userId: U.nimali.id }, "Nimali")).ok).toBe(false);
    expect((await deleteRequest(pid, r.id, { adminId: U.admin.id }, "Admin (admin)")).ok).toBe(true);
    expect(await sql`select 1 from submissions where id = ${r.id}`).toHaveLength(0);
    const [log] = await sql`select actor, detail from audit_log where action = 'deleted' and detail->>'ref_no' = ${r.refNo} and property_id = ${pid}`;
    expect(log.actor).toBe("Admin (admin)");
  });

  it("email action tokens are single use", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const a = (await pending(r.id))[0];
    const token = randomToken();
    await sql`insert into action_tokens (property_id, approval_id, token_hash, expires_at) values (${pid}, ${a.id}, ${sha256(token)}, now() + interval '7 days')`;
    expect((await resolveActionToken(token))!.used_at).toBeNull();
    await decide(pid, a.id, "approved", null, { userId: a.approver_user_id, name: "A", via: "email" });
    expect((await resolveActionToken(token))!.used_at).not.toBeNull();
    // replaying the decision is refused
    const again = await decide(pid, a.id, "approved", null, { userId: a.approver_user_id, name: "A", via: "email" });
    expect(again.ok).toBe(false);
  });

  it("form with no levels is auto-approved", async () => {
    const [f] = await sql<FormRow[]>`insert into forms (property_id, title, short_code, schema, status, visibility)
      values (${pid}, 'Auto form', ${"t" + randomToken(4)}, ${sql.json([{ id: "a", type: "text", label: "A" }])}, 'published', 'public') returning *`;
    const r = await submit(f, { a: "x" }, { userId: null, name: null, email: "x@example.com" });
    expect(r.ok && r.status).toBe("approved");
  });
});

describe("access control", () => {
  it("user without access cannot submit or review an assigned form", async () => {
    const [outsider] = await sql`insert into users (property_id, username, name, password_hash) values (${pid}, ${"out" + randomToken(3)}, 'Outsider', 'x') returning id`;
    const who = { id: outsider.id, is_admin: false };
    const acc = await tenant({ propertyId: pid, userId: outsider.id }, (tx) => formAccess(tx, who, form));
    expect(acc).toBeNull();
    expect(canSubmit(form, who, acc)).toBe(false);
    expect(canReview(acc)).toBe(false);
    // RLS: cannot even read the form or its submissions
    const rows = await tenant({ propertyId: pid, userId: outsider.id }, (tx) => tx`select id from forms where id = ${form.id}`);
    expect(rows).toHaveLength(0);
    const subs = await tenant({ propertyId: pid, userId: outsider.id }, (tx) => tx`select id from submissions`);
    expect(subs).toHaveLength(0);
  });

  it("general users see only their own submissions; reviewers see all", async () => {
    await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    const nim = await tenant({ propertyId: pid, userId: U.nimali.id }, (tx) => tx`select submitter_id from submissions`);
    expect(nim.every((s) => s.submitter_id === U.nimali.id)).toBe(true);
    const rev = await tenant({ propertyId: pid, userId: U.supervisor.id }, (tx) => tx`select id from submissions where form_id = ${form.id}`);
    expect(rev.length).toBeGreaterThan(0);
  });

  it("Review sees all submissions but cannot approve; Approval can", async () => {
    const [viewer] = await sql`insert into users (property_id, username, name, password_hash) values (${pid}, ${"rev" + randomToken(3)}, 'Viewer', 'x') returning id`;
    await sql`insert into form_access (property_id, form_id, user_id, access) values (${pid}, ${form.id}, ${viewer.id}, 'review')`;
    const who = { id: viewer.id, is_admin: false };
    const acc = await tenant({ propertyId: pid, userId: viewer.id }, (tx) => formAccess(tx, who, form));
    expect(acc).toBe("review");
    expect(canReview(acc)).toBe(true);
    expect(canApprove(acc)).toBe(false);
    const seen = await tenant({ propertyId: pid, userId: viewer.id }, (tx) => tx`select id from submissions where form_id = ${form.id}`);
    expect(seen.length).toBeGreaterThan(0);
    const sup = await tenant({ propertyId: pid, userId: U.supervisor.id }, (tx) => formAccess(tx, { id: U.supervisor.id, is_admin: false }, form));
    expect(canApprove(sup)).toBe(true);
  });

  it("properties are isolated by RLS", async () => {
    const other = await tenant({ propertyId: pid2, userId: null }, (tx) => tx`select id from forms where property_id = ${pid}`);
    expect(other).toHaveLength(0);
    const usersSeen = await tenant({ propertyId: pid2, userId: null }, (tx) => tx`select property_id from users`);
    expect(usersSeen.every((u) => u.property_id === pid2)).toBe(true);
    await expect(tenant({ propertyId: pid2, userId: null }, (tx) =>
      tx`insert into groups (property_id, name) values (${pid}, 'sneaky')`)).rejects.toThrow();
  });
});
