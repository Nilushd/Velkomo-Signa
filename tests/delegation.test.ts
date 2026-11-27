/** Out-of-office forwarding. Needs a migrated + seeded DATABASE_URL. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rootSql, tenant } from "@/lib/db";
import { submit, decide } from "@/lib/approvals";
import { forwardWaiting, returnWaiting } from "@/lib/delegation";
import type { Effect } from "@/lib/effects";
import type { FormRow } from "@/lib/types";

const sql = rootSql();
let pid = "", form: FormRow;
const U: Record<string, { id: string; name: string }> = {};
const data = { f_name: "John Silva", f_type: "Annual", f_from: "2026-12-01", f_to: "2026-12-03", f_days: 3 };

beforeAll(async () => {
  [{ id: pid }] = await sql`select id from properties where property_code = 'HTL02'`;
  for (const u of await sql<{ id: string; username: string; name: string }[]>`select id, username, name from users where property_id = ${pid}`) U[u.username] = u;
  [form] = await sql<FormRow[]>`select * from forms where property_id = ${pid} and title = 'Leave Request'`;
  await sql`update delegations set cancelled_at = now() where property_id = ${pid}`;
});
afterAll(async () => { await sql`update delegations set cancelled_at = now() where property_id = ${pid}`; await sql.end(); });

const pendingFor = (subId: string) => sql<{ id: string; level: number; approver_user_id: string; on_behalf_of: string | null; decision: string }[]>`
  select id, level, approver_user_id, on_behalf_of, decision from approvals where submission_id = ${subId} and decision = 'pending' order by level, created_at`;

describe("out of office", () => {
  it("new approvals go to the colleague, and the decision is recorded 'for' the away approver", async () => {
    // the admin (level 2) is away; Ravi covers (Ravi has no Approval access of his own)
    await sql`insert into delegations (property_id, from_user_id, to_user_id, starts_on, ends_on) values (${pid}, ${U.admin.id}, ${U.ravi.id}, current_date - 1, current_date + 3)`;
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const l1 = (await pendingFor(r.id)).find((a) => a.approver_user_id === U.manager.id)!;
    await decide(pid, l1.id, "approved", null, { userId: U.manager.id, name: U.manager.name, via: "app" });
    const [l2] = await pendingFor(r.id);
    expect(l2).toMatchObject({ level: 2, approver_user_id: U.ravi.id, on_behalf_of: U.admin.id });
    expect((await decide(pid, l2.id, "approved", "ok", { userId: U.ravi.id, name: U.ravi.name, via: "email" })).ok).toBe(true);
    const [log] = await sql`select actor from audit_log where submission_id = ${r.id} and action = 'level_approved' and (detail->>'level')::int = 2`;
    expect(log.actor).toBe(`${U.ravi.name} (for ${U.admin.name})`);
    await sql`update delegations set cancelled_at = now() where from_user_id = ${U.admin.id}`;
  });

  it("waiting approvals move to the colleague when leave starts, and come back when it is cancelled", async () => {
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const before = (await pendingFor(r.id)).find((a) => a.approver_user_id === U.supervisor.id)!;
    const [d] = await sql`insert into delegations (property_id, from_user_id, to_user_id, starts_on, ends_on) values (${pid}, ${U.supervisor.id}, ${U.nimali.id}, current_date, current_date) returning id`;
    const effects: Effect[] = [];
    const moved = await tenant({ propertyId: pid, userId: null }, (tx) => forwardWaiting(tx, effects, d.id));
    expect(moved).toBeGreaterThan(0);
    const [after] = await sql`select approver_user_id, on_behalf_of from approvals where id = ${before.id}`;
    expect(after).toMatchObject({ approver_user_id: U.nimali.id, on_behalf_of: U.supervisor.id });
    expect(effects.some((e) => e.kind === "notify" && e.userId === U.nimali.id)).toBe(true);
    await sql`update delegations set cancelled_at = now() where id = ${d.id}`;
    await tenant({ propertyId: pid, userId: null }, (tx) => returnWaiting(tx, [], d.id));
    const [back] = await sql`select approver_user_id, on_behalf_of from approvals where id = ${before.id}`;
    expect(back).toMatchObject({ approver_user_id: U.supervisor.id, on_behalf_of: null });
  });

  it("forwarding only selected forms leaves other forms with the original approver; one form can be stopped", async () => {
    const [pf] = await sql<FormRow[]>`insert into forms (property_id, owner_id, title, short_code, schema, status, visibility)
      values (${pid}, ${U.admin.id}, 'Purchase Requisition', ${"pr" + Math.random().toString(36).slice(2, 8)}, ${sql.json([{ id: "item", type: "text", label: "Item" }])}, 'published', 'all_users') returning *`;
    await sql`insert into form_access (property_id, form_id, user_id, access) values (${pid}, ${pf.id}, ${U.admin.id}, 'approve')`;
    const [st] = await sql`insert into approval_steps (property_id, form_id, level, name, channel) values (${pid}, ${pf.id}, 1, 'Admin approval', 'app') returning id`;
    await sql`insert into approval_step_approvers (property_id, step_id, user_id) values (${pid}, ${st.id}, ${U.admin.id})`;
    // admin away, but only Purchase Requisition goes to Ravi
    const [d] = await sql`insert into delegations (property_id, from_user_id, to_user_id, starts_on, ends_on) values (${pid}, ${U.admin.id}, ${U.ravi.id}, current_date, current_date + 2) returning id`;
    await sql`insert into delegation_forms (property_id, delegation_id, form_id) values (${pid}, ${d.id}, ${pf.id})`;
    const pr = await submit(pf, { item: "Printer toner" }, { userId: U.john.id, name: U.john.name, email: null });
    if (!pr.ok) throw new Error(pr.error);
    expect((await pendingFor(pr.id))[0]).toMatchObject({ approver_user_id: U.ravi.id, on_behalf_of: U.admin.id });
    // Leave Request level 2 still goes to the admin
    const lr = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!lr.ok) throw new Error(lr.error);
    const l1 = (await pendingFor(lr.id)).find((a) => a.approver_user_id === U.manager.id)!;
    await decide(pid, l1.id, "approved", null, { userId: U.manager.id, name: U.manager.name, via: "app" });
    expect((await pendingFor(lr.id))[0]).toMatchObject({ level: 2, approver_user_id: U.admin.id, on_behalf_of: null });
    // stop forwarding the purchase form: its waiting approval comes back
    const back = await tenant({ propertyId: pid, userId: null }, (tx) => returnWaiting(tx, [], d.id, pf.id));
    expect(back).toBe(1);
    expect((await pendingFor(pr.id))[0]).toMatchObject({ approver_user_id: U.admin.id, on_behalf_of: null });
    await sql`update delegations set cancelled_at = now() where id = ${d.id}`;
  });

  it("someone who turned approval e-mails off gets an app notification instead of an e-mail", async () => {
    await sql`update users set email_approvals = false where id = ${U.supervisor.id}`;
    try {
      const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
      if (!r.ok) throw new Error(r.error);
      const mails = await sql`select to_address from email_log where property_id = ${pid} and subject like ${"%" + r.refNo + "%"} and subject like 'Approval needed%'`;
      const to = mails.map((m) => m.to_address);
      expect(to.some((t: string) => t.startsWith("supervisor."))).toBe(false); // no e-mail for Sam
      expect(to.some((t: string) => t.startsWith("manager."))).toBe(true);     // Maya still gets hers
      const [n] = await sql`select count(*)::int as n from notifications where user_id = ${U.supervisor.id} and body like ${r.refNo + "%"}`;
      expect(n.n).toBe(1);
    } finally { await sql`update users set email_approvals = true where id = ${U.supervisor.id}`; }
  });

  it("a colleague who is already an approver on that level isn't given the same approval twice", async () => {
    // manager and supervisor are both level-1 approvers; supervisor away, covered by manager
    await sql`insert into delegations (property_id, from_user_id, to_user_id, starts_on, ends_on) values (${pid}, ${U.supervisor.id}, ${U.manager.id}, current_date, current_date + 1)`;
    const r = await submit(form, data, { userId: U.john.id, name: U.john.name, email: null });
    if (!r.ok) throw new Error(r.error);
    const l1 = (await pendingFor(r.id)).filter((a) => a.level === 1);
    expect(l1.map((a) => a.approver_user_id)).toEqual([U.manager.id]);
    await sql`update delegations set cancelled_at = now() where from_user_id = ${U.supervisor.id}`;
  });
});

