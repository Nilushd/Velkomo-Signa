import { requirePlatformAdmin } from "@/lib/platform-auth";
import { PageHeader } from "@/components/ui";
import { computeBilling, money, CURRENCIES } from "@/lib/billing";
import { fmtDay } from "@/lib/subscription";
import { BillingTable, PricingForm, PeriodPicker } from "./client";

export const metadata = { title: "Contracts & billing" };

const ym = (d: Date) => d.toISOString().slice(0, 7);
const okYm = (s: string | undefined) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; contract?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const thisMonth = ym(new Date());
  let from = okYm(sp.from) ? sp.from! : thisMonth, to = okYm(sp.to) ? sp.to! : from;
  if (to < from) [from, to] = [to, from];
  const b = await computeBilling(from, to);
  const cur = b.settings.currency;
  const label = from === to ? new Date(`${from}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : `${fmtDay(b.start)} – ${fmtDay(b.end)}`;
  return (
    <>
      <PageHeader title="Contracts & billing" subtitle="Hotels pay per enabled form type, per day — not per submission (submissions are unlimited). Form types a hotel admin disables, and drafts, are not charged." />
      <section className="card mb-6 p-5 print:shadow-none print:ring-0">
        {b.toDate && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-200">This period is still running — figures are <b>to date ({fmtDay(b.toDate)})</b> and grow each day. The minimum charge applies to the whole month.</p>}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold">Bill calculator</h2>
            <p className="text-sm text-ink-mute">Each form type costs the monthly rate ÷ days in the month, for every day it was enabled — however many times it was filled in. <b>1 form-month</b> = one form type enabled for a whole month. Updated daily.</p></div>
          <PeriodPicker from={from} to={to} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Period", `${label}${b.months > 1 ? ` · ${b.months} months` : ""}`], ["Form-months billed", b.totals.billed.toFixed(2)],
            ["Before tax", money(b.totals.total - b.totals.tax, cur)], ["Total to invoice", money(b.totals.total, cur)]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-ink-wash/60 p-3"><p className="text-xs font-medium text-ink-mute">{l}</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{v}</p></div>))}
        </div>
        <BillingTable rows={b.rows} currency={cur} from={from} to={to} totals={b.totals} taxPct={b.settings.tax_pct} openContract={sp.contract} />
      </section>
      <section className="card p-5 print:hidden">
        <h2 className="font-semibold">Default pricing</h2>
        <p className="mb-4 text-sm text-ink-mute">Used for every hotel unless its contract sets its own rate or minimum.</p>
        <PricingForm currencies={CURRENCIES} s={b.settings} />
      </section>
    </>
  );
}
