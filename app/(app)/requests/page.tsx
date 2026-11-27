import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { PageHeader, StatusBadge, Empty, Alert } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "My Requests" };

export default async function Requests({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const u = await requireUser();
  const { deleted } = await searchParams;
  const rows = await asUser(u, (tx) => tx<{ id: string; ref_no: string; title: string; status: string; current_level: number; levels: number; version: number; created_at: Date; updated_at: Date; comment: string | null }[]>`
    select s.id, s.ref_no, f.title, s.status, s.current_level, s.version, s.created_at, s.updated_at,
      (select count(*)::int from approval_steps st where st.form_id = f.id) as levels,
      (select a.comment from approvals a where a.submission_id = s.id and a.decision = 'rejected' and a.version = s.version order by a.decided_at desc limit 1) as comment
    from submissions s join forms f on f.id = s.form_id where s.submitter_id = ${u.id} order by s.updated_at desc`);
  return (
    <>
      <PageHeader title="My Requests" subtitle="Everything you've submitted and where it is." actions={<Link href="/my-forms" className="btn-primary">New request</Link>} />
      {deleted && <div className="mb-4"><Alert kind="success">{deleted} was deleted.</Alert></div>}
      {rows.length === 0 ? <Empty title="No requests yet">Open a form from My Forms to submit your first request.</Empty> :
        <ul className="space-y-2">{rows.map((r) => (
          <li key={r.id}><Link href={`/requests/${r.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-brand-300">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-ink-mute"><span className="font-mono">{r.ref_no}</span>{r.version > 1 ? ` · v${r.version}` : ""} · {fmtDate(r.created_at, false)}
                {r.status === "pending" && r.levels > 0 ? ` · level ${r.current_level} of ${r.levels}` : ""}</p>
              {r.status === "rejected" && r.comment && <p className="mt-1 text-sm text-red-700">“{r.comment}”</p>}
            </div>
            <div className="flex items-center gap-2">
              {r.status === "rejected" && <span className="btn-primary btn-sm">Edit and resubmit</span>}
              <StatusBadge status={r.status} />
            </div>
          </Link></li>))}</ul>}
    </>
  );
}
