/**
 * Demo data: Super Admin (property VELKOMO) + two demo properties HTL01 and HTL02 to prove data isolation.
 * Per property: 1 admin, 2 reviewers, 3 general users, a "Leave Request" form with 2 levels (level 1 has 2 approvers).
 * Usage: npm run db:seed   (safe to re-run: skips properties that already exist)
 */
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { randomBytes } from "crypto";

const PASSWORD = process.env.SEED_PASSWORD || "Welcome123";

const leaveSchema = [
  { id: "f_name", type: "text", label: "Full name", required: true },
  { id: "f_email", type: "email", label: "Email", required: false, help: "We'll send the decision here" },
  { id: "f_type", type: "select", label: "Leave type", required: true, options: ["Annual", "Sick", "Casual", "Unpaid"] },
  { id: "f_from", type: "date", label: "From", required: true },
  { id: "f_to", type: "date", label: "To", required: true },
  { id: "f_days", type: "number", label: "Number of days", required: true },
  { id: "f_reason", type: "textarea", label: "Reason", required: false },
  { id: "f_sig", type: "signature", label: "Signature", required: false },
];

function code() { return randomBytes(5).toString("hex").slice(0, 7); }

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  const hash = await bcrypt.hash(PASSWORD, 10);

  async function property(pc: string, name: string) {
    const [ex] = await sql`select id from properties where lower(property_code) = lower(${pc})`;
    if (ex) { console.log(`property ${pc} exists, skipping`); return null; }
    const [p] = await sql`insert into properties (property_code, name) values (${pc}, ${name}) returning id`;
    return p.id as string;
  }
  async function user(pid: string, username: string, name: string, dept: string, extra: Partial<{ is_admin: boolean; is_super_admin: boolean; email: string; can_build_forms: boolean }> = {}) {
    const [u] = await sql`insert into users (property_id, username, name, department, email, password_hash, is_admin, is_super_admin, can_build_forms, must_change_password)
      values (${pid}, ${username}, ${name}, ${dept}, ${extra.email ?? null}, ${hash}, ${extra.is_admin ?? false}, ${extra.is_super_admin ?? false}, ${extra.can_build_forms ?? false}, false) returning id`;
    return u.id as string;
  }

  const sp = await property("VELKOMO", "Velkomo Platform");
  if (sp) await user(sp, "superadmin", "Super Admin", "Platform", { is_super_admin: true, is_admin: true, email: "superadmin@example.com" });

  for (const [pc, name] of [["HTL01", "Demo Hotel One"], ["HTL02", "Demo Hotel Two"]]) {
    const pid = await property(pc, name);
    if (!pid) continue;
    const lc = pc.toLowerCase();
    const admin = await user(pid, "admin", `${name} Admin`, "Management", { is_admin: true, email: `admin.${lc}@example.com` });
    const r1 = await user(pid, "manager", "Maya Perera", "Front Office", { email: `manager.${lc}@example.com`, can_build_forms: true });
    const r2 = await user(pid, "supervisor", "Sam Fernando", "Front Office", { email: `supervisor.${lc}@example.com` });
    const g1 = await user(pid, "john", "John Silva", "Housekeeping", { email: `john.${lc}@example.com` });
    const g2 = await user(pid, "nimali", "Nimali Jayasinghe", "Kitchen");
    const g3 = await user(pid, "ravi", "Ravi Kumar", "Maintenance", { email: `ravi.${lc}@example.com` });
    const [grp] = await sql`insert into groups (property_id, name) values (${pid}, 'Front Office') returning id`;
    for (const m of [r1, r2]) await sql`insert into group_members (property_id, group_id, user_id) values (${pid}, ${grp.id}, ${m})`;

    const [form] = await sql`insert into forms (property_id, owner_id, title, description, short_code, schema, theme, status, visibility)
      values (${pid}, ${admin}, 'Leave Request', 'Apply for leave. A front-office reviewer checks it first, then the admin approves.', ${code()},
        ${sql.json(leaveSchema)}, ${sql.json({ primary: "#2563EB", background: "#F4F7FC", font: "sans", thankYou: "Thanks! Your leave request is with your supervisor." })},
        'published', 'assigned') returning id`;
    for (const [u, a] of [[admin, "review"], [r1, "review"], [r2, "review"], [g1, "general"], [g2, "general"], [g3, "general"]] as const)
      await sql`insert into form_access (property_id, form_id, user_id, access) values (${pid}, ${form.id}, ${u}, ${a})`;
    const [s1] = await sql`insert into approval_steps (property_id, form_id, level, name, channel, reminder_days) values (${pid}, ${form.id}, 1, 'Supervisor review', 'both', 2) returning id`;
    const [s2] = await sql`insert into approval_steps (property_id, form_id, level, name, channel) values (${pid}, ${form.id}, 2, 'Admin approval', 'both') returning id`;
    await sql`insert into approval_step_approvers (property_id, step_id, user_id) values (${pid}, ${s1.id}, ${r1}), (${pid}, ${s1.id}, ${r2})`;
    await sql`insert into approval_step_approvers (property_id, step_id, user_id) values (${pid}, ${s2.id}, ${admin})`;
    console.log(`seeded ${pc} (${name})`);
  }
  console.log(`\nLogin with password "${PASSWORD}":\n  VELKOMO / superadmin\n  HTL01 or HTL02 / admin, manager, supervisor (reviewers), john, nimali, ravi (general)`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
