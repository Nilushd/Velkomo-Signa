import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { loadDelegations } from "@/lib/delegation";
import { PageHeader, StatusBadge, Alert } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ pw?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const d = await asUser(u, async (tx) => {
    const [forms] = await tx<{ n: number }[]>`select count(*)::int as n from forms where status <> 'draft' or owner_id = ${u.id} or ${u.is_admin}`;
    const stats = await tx<{ status: string; n: number }[]>`
      select status, count(*)::int as n from submissions
      where status = 'pending' or updated_at >= date_trunc('month', now()) group by status`;
    const waiting = await tx<{ id: string; ref_no: string; title: string; step_name: string; created_at: Date; submitter_name: string | null; for_name: string | null }[]>`
      select a.id, s.ref_no, f.title, a.step_name, a.created_at, s.submitter_name, (select name from users where id = a.on_behalf_of) as for_name
      from approvals a join submissions s on s.id = a.submission_id join forms f on f.id = s.form_id
      where a.approver_user_id = ${u.id} and a.decision = 'pending' and s.status = 'pending' and s.version = a.version and s.current_level = a.level
      order by a.created_at limit 5`;
    const mine = await tx<{ id: string; ref_no: string; title: string; status: string; updated_at: Date }[]>`
      select s.id, s.ref_no, f.title, s.status, s.updated_at from submissions s join forms f on f.id = s.form_id
      where s.submitter_id = ${u.id} order by s.updated_at desc limit 5`;
    const dl = await loadDelegations(tx, u.id);
    return { dl, forms: forms.n, stats: Object.fromEntries(stats.map((s) => [s.status, s.n])), waiting, mine };
  });
  const tiles = [
    { label: "Forms", value: d.forms, href: u.is_admin || u.can_build_forms ? "/forms" : "/my-forms" },
    { label: "Pending", value: d.stats.pending ?? 0, href: "/submissions?status=pending" },
    { label: "Approved this month", value: d.stats.approved ?? 0, href: "/submissions?status=approved" },
    { label: "Rejected this month", value: d.stats.rejected ?? 0, href: "/submissions?status=rejected" },
  ];
  return (
    <>
      <PageHeader title={`Hello, ${u.name.split(" ")[0]}`} subtitle={`${u.property_name} · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
        actions={<Link href="/my-forms" className="btn-primary">Fill a form</Link>} />
      {d.dl.covering.filter((x) => x.active).map((x) => <div key={x.id} className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200">You&apos;re covering for <b>{x.other}</b> ({x.forms.length ? x.forms.map((f) => f.title).join(", ") : "all forms"}) until {x.ends_on}. Their approvals show below marked “for {x.other}”.</div>)}
      {d.dl.forwarding.filter((x) => x.active).map((x) => <div key={x.id} className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">You&apos;re out of office until {x.ends_on} — {x.forms.length ? x.forms.map((f) => f.title).join(", ") : "your approvals"} go{x.forms.length === 1 ? "es" : ""} to <b>{x.other}</b>. <Link href="/settings#out-of-office" className="underline">Change</Link></div>)}
      {sp.pw === "changed" && <div className="mb-4"><Alert kind="success">Your password was changed.</Alert></div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card p-4 transition hover:border-brand-300">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">{t.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{t.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
            <h2 className="font-semibold">Waiting for your approval</h2>
            <Link href="/approvals" className="text-sm text-brand-700 hover:underline">All</Link>
          </div>
          {d.waiting.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-mute">Nothing waiting. Nice.</p> :
            <ul className="divide-y divide-ink-line">{d.waiting.map((w) => (
              <li key={w.id}><Link href={`/approvals/${w.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-wash">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{w.title}{w.for_name && <span className="badge ml-2 bg-amber-50 align-middle text-amber-900 ring-1 ring-amber-200">for {w.for_name}</span>}</p><p className="text-xs text-ink-mute">{w.ref_no} · {w.step_name} · {w.submitter_name ?? "Public"}</p></div>
                <span className="text-xs text-ink-mute">{fmtDate(w.created_at, false, u.time_zone)}</span></Link></li>))}</ul>}
        </section>
        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
            <h2 className="font-semibold">Your recent requests</h2>
            <Link href="/requests" className="text-sm text-brand-700 hover:underline">All</Link>
          </div>
          {d.mine.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-mute">You haven&apos;t submitted anything yet.</p> :
            <ul className="divide-y divide-ink-line">{d.mine.map((m) => (
              <li key={m.id}><Link href={`/requests/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-wash">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{m.title}</p><p className="text-xs text-ink-mute">{m.ref_no} · {fmtDate(m.updated_at, false, u.time_zone)}</p></div>
                <StatusBadge status={m.status} /></Link></li>))}</ul>}
        </section>
      </div>
    </>
  );
}
