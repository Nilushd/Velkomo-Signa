import Link from "next/link";
import clsx from "clsx";
import { requireUser, asUser } from "@/lib/auth";
import { loadDelegations } from "@/lib/delegation";
import { CalendarClock } from "lucide-react";
import { PageHeader, Empty, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "My Approvals" };

export default async function Approvals({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const tab = (await searchParams).tab === "done" ? "done" : "pending";
  const dl = await asUser(u, (tx) => loadDelegations(tx, u.id));
  const rows = await asUser(u, (tx) => tx<{ id: string; ref_no: string; title: string; step_name: string; level: number; decision: string; closed_note: string | null; decided_at: Date | null; created_at: Date; submitter: string | null; version: number; sub_status: string; for_name: string | null }[]>`
    select a.id, (select name from users where id = a.on_behalf_of) as for_name, s.ref_no, f.title, a.step_name, a.level, a.decision, a.closed_note, a.decided_at, a.created_at, a.version, s.status as sub_status,
      coalesce(us.name, s.submitter_name, s.submitter_email, 'Public requester') as submitter
    from approvals a join submissions s on s.id = a.submission_id join forms f on f.id = s.form_id left join users us on us.id = s.submitter_id
    where a.approver_user_id = ${u.id} and ${tab === "pending"
      ? tx`a.decision = 'pending' and s.status = 'pending' and s.version = a.version and s.current_level = a.level`
      : tx`(a.decision <> 'pending' or s.status <> 'pending' or s.version <> a.version)`}
    order by ${tab === "pending" ? tx`a.created_at` : tx`coalesce(a.decided_at, a.created_at) desc`} limit 200`);
  return (
    <>
      <PageHeader title="My Approvals" subtitle="Requests waiting for your decision." actions={<Link href="/settings#out-of-office" className="btn-secondary"><CalendarClock className="h-4 w-4" /> Out of office</Link>} />
      {dl.forwarding.filter((d) => d.active).map((d) => <div key={d.id} className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">You&apos;re out of office until {d.ends_on} — new approvals go to <b>{d.other}</b>. <Link href="/settings#out-of-office" className="underline">Change</Link></div>)}
      {dl.covering.filter((d) => d.active).map((d) => <div key={d.id} className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200">You&apos;re covering for <b>{d.other}</b> until {d.ends_on}. Their approvals are marked “for {d.other}”.</div>)}
      <div className="mb-4 flex gap-1 border-b border-ink-line">
        <Link href="/approvals" className={clsx("tab", tab === "pending" && "tab-active")}>Pending</Link>
        <Link href="/approvals?tab=done" className={clsx("tab", tab === "done" && "tab-active")}>Done</Link>
      </div>
      {rows.length === 0 ? <Empty title={tab === "pending" ? "You're all caught up" : "Nothing here yet"} /> :
        <ul className="space-y-2">{rows.map((r) => (
          <li key={r.id}><Link href={`/approvals/${r.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-brand-300">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}{r.for_name && <span className="badge ml-2 bg-amber-50 align-middle text-amber-900 ring-1 ring-amber-200">for {r.for_name}</span>}</p>
              <p className="text-sm text-ink-mute"><span className="font-mono">{r.ref_no}</span> · {r.submitter} · Level {r.level}: {r.step_name}</p>
              {tab === "done" && <p className="text-xs text-ink-mute">{r.decision === "closed" ? (r.closed_note ?? "Closed") : r.decision === "pending" ? "No longer waiting" : `You ${r.decision}`} · {fmtDate(r.decided_at ?? r.created_at)}</p>}
            </div>
            {tab === "pending" ? <span className="text-xs text-ink-mute">{fmtDate(r.created_at)}</span> : <StatusBadge status={r.sub_status} />}
          </Link></li>))}</ul>}
    </>
  );
}
