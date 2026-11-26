import Link from "next/link";
import { requireBuilder, asUser, canStudio } from "@/lib/auth";
import { PageHeader, StatusBadge, Empty, Alert } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { Wand2, Plus, Pencil, Share2 } from "lucide-react";

export const metadata = { title: "Forms" };

const VIS: Record<string, string> = { public: "Public", all_users: "All users", assigned: "Assigned users" };

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const u = await requireBuilder();
  const { denied } = await searchParams;
  const forms = await asUser(u, (tx) => tx<{ id: string; title: string; status: string; visibility: string; short_code: string; updated_at: Date; owner: string | null; total: number; pending: number; levels: number }[]>`
    select f.id, f.title, f.status, f.visibility, f.short_code, f.updated_at, o.name as owner,
      (select count(*)::int from submissions s where s.form_id = f.id) as total,
      (select count(*)::int from submissions s where s.form_id = f.id and s.status = 'pending') as pending,
      (select count(*)::int from approval_steps st where st.form_id = f.id) as levels
    from forms f left join users o on o.id = f.owner_id
    where ${u.is_admin} or f.owner_id = ${u.id}
    order by f.updated_at desc`);
  return (
    <>
      <PageHeader title="Forms" subtitle={u.is_admin ? "Every form in this property." : "Forms you own."}
        actions={<>
          <Link href="/forms/new" className="btn-secondary"><Plus className="h-4 w-4" /> Blank form</Link>
          {canStudio(u) && <Link href="/forms/studio" className="btn-primary"><Wand2 className="h-4 w-4" /> Design from a sample</Link>}
        </>} />
      {denied === "studio" && <div className="mb-4"><Alert kind="warn">Form Studio isn&apos;t switched on for your account. Ask your admin (Users &amp; Groups → Feature access).</Alert></div>}
      {forms.length === 0 ? <Empty title="No forms yet">Open Form Studio and drop in a sample — an Excel sheet, a PDF or a photo of your paper form — or start from a blank form.</Empty> :
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Form</th><th>Status</th><th>Visibility</th><th className="text-right">Submissions</th><th className="text-right">Pending</th><th>Levels</th><th>Updated</th><th></th></tr></thead>
            <tbody>{forms.map((f) => (
              <tr key={f.id} className="hover:bg-ink-wash/60">
                <td><Link href={`/forms/${f.id}/edit`} className="font-medium text-ink hover:text-brand-700">{f.title}</Link><p className="text-xs text-ink-mute">/f/{f.short_code}{f.owner ? ` · ${f.owner}` : ""}</p></td>
                <td><StatusBadge status={f.status} /></td>
                <td className="text-ink-soft">{VIS[f.visibility]}</td>
                <td className="text-right tabular-nums">{f.total}</td>
                <td className="text-right tabular-nums">{f.pending}</td>
                <td className="text-ink-soft">{f.levels === 0 ? "Auto-accept" : f.levels}</td>
                <td className="whitespace-nowrap text-ink-mute">{fmtDate(f.updated_at, false)}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/forms/${f.id}/edit`} className="btn-ghost btn-sm"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                    <Link href={`/forms/${f.id}/edit?share=1`} className="btn-ghost btn-sm"><Share2 className="h-3.5 w-3.5" /> Share</Link>
                    <Link href={`/submissions?form=${f.id}`} className="btn-ghost btn-sm">Submissions</Link>
                  </div>
                </td>
              </tr>))}</tbody>
          </table>
        </div>}
    </>
  );
}
