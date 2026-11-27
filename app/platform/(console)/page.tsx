import Link from "next/link";
import clsx from "clsx";
import { Plus, Search } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { rootSql } from "@/lib/db";
import { PageHeader, Alert } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { fmtDay } from "@/lib/subscription";
import { subState, type SubState } from "./status";
import { HotelTable, type HotelRow } from "./hotel-table";
import { storageUsage } from "@/lib/housekeeping";

export const metadata = { title: "Platform" };

type Row = { id: string; property_code: string; name: string; notes: string | null; active: boolean; ends: string | null; days_left: number | null; created_at: Date;
  admins: number; users: number; forms: number; subs: number; last_seen: Date | null };

const FILTERS: { v: string; label: string; match: (s: SubState) => boolean }[] = [
  { v: "all", label: "All", match: () => true },
  { v: "active", label: "Active", match: (s) => s === "active" || s === "open" },
  { v: "expiring", label: "Expiring ≤ 30 days", match: (s) => s === "expiring" },
  { v: "expired", label: "Expired", match: (s) => s === "expired" },
  { v: "suspended", label: "Suspended", match: (s) => s === "suspended" },
];

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; deleted?: string; edit?: string }> }) {
  await requirePlatformAdmin();
  const { show = "all", q = "", deleted, edit } = await searchParams;
  const sql = rootSql();
  const all = await sql<Row[]>`
    select p.id, p.property_code, p.name, p.notes, p.active, to_char(p.subscription_ends, 'YYYY-MM-DD') as ends, (p.subscription_ends - current_date)::int as days_left, p.created_at,
      (select count(*)::int from users where property_id = p.id and is_admin and active) as admins,
      (select count(*)::int from users where property_id = p.id and active) as users,
      (select count(*)::int from forms where property_id = p.id) as forms,
      (select count(*)::int from submissions where property_id = p.id) as subs,
      (select max(s.created_at) from sessions s join users x on x.id = s.user_id where x.property_id = p.id) as last_seen
    from properties p
    order by case when p.subscription_ends is null then 1 else 0 end, p.subscription_ends, p.name`;
  const withState = all.map((p) => ({ ...p, state: subState(p) }));
  const count = (f: string) => withState.filter((p) => FILTERS.find((x) => x.v === f)!.match(p.state)).length;
  const term = q.trim().toLowerCase();
  const shown = withState.filter((p) => (FILTERS.find((x) => x.v === show) ?? FILTERS[0]).match(p.state) && (!term || p.name.toLowerCase().includes(term) || p.property_code.toLowerCase().includes(term)));
  const admins = await sql<(HotelRow["admins"][number] & { property_id: string; seen: Date | null })[]>`
    select u.property_id, u.id, u.username, u.name, u.email, u.active, u.must_change_password, (u.locked_until is not null and u.locked_until > now()) as locked,
      (u.totp_enabled_at is not null) as totp, (select max(created_at) from sessions where user_id = u.id) as seen
    from users u where u.is_admin and u.property_id = any(${shown.map((p) => p.id)}::uuid[]) order by u.created_at`;
  const mb = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const rows: HotelRow[] = await Promise.all(shown.map(async (p) => {
    const st = await storageUsage(p.id);
    return { id: p.id, property_code: p.property_code, name: p.name, notes: p.notes, active: p.active, ends: p.ends, endsLabel: p.ends ? fmtDay(p.ends) : null,
      days_left: p.days_left, state: p.state, users: p.users, forms: p.forms, subs: p.subs, last_seen: p.last_seen ? fmtDate(p.last_seen, false) : null,
      storage: mb(st.fileBytes + st.dataBytes),
      admins: admins.filter((a) => a.property_id === p.id).map(({ property_id: _p, seen, ...a }) => ({ ...a, last_seen: seen ? fmtDate(seen) : null })) };
  }));
  const log = await sql<{ at: Date; actor_name: string; property_code: string; property_name: string; action: string; detail: string | null }[]>`
    select at, actor_name, property_code, property_name, action, detail from platform_log order by at desc limit 15`;
  const tiles = [
    { label: "Hotels", value: all.length, f: "all" },
    { label: "Active", value: count("active"), f: "active" },
    { label: "Expiring in 30 days", value: count("expiring"), f: "expiring", warn: count("expiring") > 0 },
    { label: "Expired", value: count("expired"), f: "expired", bad: count("expired") > 0 },
    { label: "Suspended", value: count("suspended"), f: "suspended" },
  ];
  return (
    <>
      <PageHeader title="Hotels" subtitle="Every hotel on Velkomo Signa — subscriptions and admin accounts."
        actions={<Link href="/platform/new" className="btn-primary"><Plus className="h-4 w-4" /> New hotel</Link>} />
      {deleted && <div className="mb-4"><Alert kind="success">Hotel {deleted} and all its data were deleted.</Alert></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} href={`/platform?show=${t.f}`} className={clsx("card p-4 transition hover:ring-brand-300", show === t.f && "ring-2 ring-brand-500")}>
            <p className="text-xs font-medium text-ink-mute">{t.label}</p>
            <p className={clsx("mt-1 text-2xl font-semibold tabular-nums", t.warn && "text-amber-700", t.bad && "text-red-700")}>{t.value}</p>
          </Link>))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => <Link key={f.v} href={`/platform?show=${f.v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          className={clsx("rounded-full px-3 py-1 text-sm ring-1", show === f.v ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-soft ring-ink-line hover:bg-ink-wash")}>{f.label}</Link>)}
        <form className="relative ml-auto w-full sm:w-64"><input type="hidden" name="show" value={show} />
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-mute" />
          <input name="q" defaultValue={q} className="input pl-9" placeholder="Search hotel or code" /></form>
      </div>
      <HotelTable rows={rows} initialEdit={edit} />
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Recent platform activity</h2>
        {log.length === 0 ? <p className="text-sm text-ink-mute">Nothing yet.</p> : (
          <ul className="divide-y divide-ink-line text-sm">{log.map((l, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 py-2"><span className="w-36 shrink-0 text-ink-mute">{fmtDate(l.at)}</span>
              <span className="flex-1"><b>{l.action}</b> · {l.property_name} <span className="font-mono text-xs text-ink-mute">{l.property_code}</span>{l.detail && <span className="text-ink-soft"> — {l.detail}</span>}</span>
              <span className="text-ink-mute">{l.actor_name}</span></li>))}</ul>)}
      </section>
    </>
  );
}
