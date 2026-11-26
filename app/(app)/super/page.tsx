import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { setPropertyActive } from "@/app/actions/property";
import { fmtDate } from "@/lib/format";
import { NewProperty } from "./new-property";

export const metadata = { title: "Properties" };

export default async function SuperPage() {
  const u = await requireUser();
  if (!u.is_super_admin) redirect("/");
  // Super Admin works across properties, so this page reads with the privileged connection.
  const props = await rootSql()<{ id: string; property_code: string; name: string; active: boolean; created_at: Date; users: number; forms: number; submissions: number }[]>`
    select p.id, p.property_code, p.name, p.active, p.created_at,
      (select count(*)::int from users where property_id = p.id) as users,
      (select count(*)::int from forms where property_id = p.id) as forms,
      (select count(*)::int from submissions where property_id = p.id) as submissions
    from properties p order by p.created_at`;
  return (
    <>
      <PageHeader title="Properties" subtitle="Super Admin: each property has its own code, users, forms and data." />
      <div className="card mb-6 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th className="text-right">Users</th><th className="text-right">Forms</th><th className="text-right">Submissions</th><th>Created</th><th></th></tr></thead>
          <tbody>{props.map((p) => (
            <tr key={p.id} className={p.active ? "" : "opacity-60"}>
              <td className="font-mono font-semibold">{p.property_code}</td><td>{p.name}</td>
              <td className="text-right tabular-nums">{p.users}</td><td className="text-right tabular-nums">{p.forms}</td><td className="text-right tabular-nums">{p.submissions}</td>
              <td className="text-ink-mute">{fmtDate(p.created_at, false)}</td>
              <td className="text-right">{p.id !== u.property_id && <form action={setPropertyActive.bind(null, p.id, !p.active)}><button className="btn-secondary btn-sm">{p.active ? "Deactivate" : "Activate"}</button></form>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <NewProperty />
    </>
  );
}
