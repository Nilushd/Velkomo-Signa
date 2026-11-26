import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { formAccess, canReview } from "@/lib/access";
import { PageHeader, StatusBadge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { Download } from "lucide-react";

export const metadata = { title: "Submissions" };

interface SP { form?: string; status?: string; q?: string; from?: string; to?: string }

export default async function Submissions({ searchParams }: { searchParams: Promise<SP> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const formId = sp.form && /^[0-9a-f-]{36}$/.test(sp.form) ? sp.form : null;
  const status = ["pending", "approved", "rejected", "withdrawn"].includes(sp.status ?? "") ? sp.status! : null;
  const q = sp.q?.trim() || null;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null;

  const { forms, rows, exportable } = await asUser(u, async (tx) => {
    // RLS limits rows: admins see everything, reviewers see their forms, others only their own
    const forms = await tx<{ id: string; title: string; owner_id: string | null }[]>`
      select distinct f.id, f.title, f.owner_id from forms f join submissions s on s.form_id = f.id order by f.title`;
    const like = q ? `%${q}%` : null;
    const rows = await tx<{ id: string; ref_no: string; title: string; status: string; current_level: number; created_at: Date; submitter: string | null; version: number }[]>`
      select s.id, s.ref_no, f.title, s.status, s.current_level, s.created_at, s.version,
        coalesce(us.name, s.submitter_name, s.submitter_email, 'Public requester') as submitter
      from submissions s join forms f on f.id = s.form_id left join users us on us.id = s.submitter_id
      where (${formId}::uuid is null or s.form_id = ${formId})
        and (${status}::text is null or s.status = ${status})
        and (${from}::date is null or s.created_at >= ${from}::date)
        and (${to}::date is null or s.created_at < ${to}::date + 1)
        and (${like}::text is null or s.ref_no ilike ${like} or coalesce(us.name, s.submitter_name, s.submitter_email, '') ilike ${like} or s.data::text ilike ${like})
      order by s.created_at desc limit 500`;
    let exportable = false;
    if (formId) { const f = forms.find((x) => x.id === formId); if (f) exportable = canReview(await formAccess(tx, u, f)); }
    return { forms, rows, exportable };
  });
  const qs = (fmt: string) => `/api/export/${formId}?format=${fmt}${status ? `&status=${status}` : ""}`;
  return (
    <>
      <PageHeader title="Submissions" subtitle={u.is_admin ? "All submissions in this property." : "Submissions you can see."}
        actions={formId && exportable ? <>
          <a href={qs("xlsx")} className="btn-secondary"><Download className="h-4 w-4" /> Excel</a>
          <a href={qs("csv")} className="btn-secondary"><Download className="h-4 w-4" /> CSV</a></> : undefined} />
      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q ?? ""} className="input" placeholder="Search ref no, name, answers…" aria-label="Search" />
        <select name="form" defaultValue={formId ?? ""} className="input" aria-label="Form"><option value="">All forms</option>{forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
        <select name="status" defaultValue={status ?? ""} className="input" aria-label="Status"><option value="">Any status</option>{["pending", "approved", "rejected", "withdrawn"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select>
        <input type="date" name="from" defaultValue={from ?? ""} className="input" aria-label="From date" />
        <input type="date" name="to" defaultValue={to ?? ""} className="input" aria-label="To date" />
        <button className="btn-primary">Filter</button>
      </form>
      {!formId && <p className="mb-3 text-xs text-ink-mute">Choose a form to export its submissions to Excel or CSV.</p>}
      {rows.length === 0 ? <Empty title="No submissions match" /> :
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Ref no</th><th>Form</th><th>Date</th><th>Submitter</th><th>Status</th><th>Level</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-wash/60">
                <td><Link href={`/requests/${r.id}`} className="font-mono font-medium text-brand-700 hover:underline">{r.ref_no}</Link>{r.version > 1 && <span className="ml-1 text-xs text-ink-mute">v{r.version}</span>}</td>
                <td>{r.title}</td>
                <td className="whitespace-nowrap text-ink-mute">{fmtDate(r.created_at)}</td>
                <td>{r.submitter}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-ink-mute">{r.status === "pending" ? r.current_level : "—"}</td>
              </tr>))}</tbody>
          </table>
          {rows.length === 500 && <p className="p-3 text-xs text-ink-mute">Showing the latest 500. Narrow the filters or export.</p>}
        </div>}
    </>
  );
}
