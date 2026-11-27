"use client";
import { Fragment, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Download, FileSignature, Printer, X } from "lucide-react";
import { saveBillingSettings, saveContract } from "@/app/actions/platform";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { BillRow, BillingSettings } from "@/lib/billing";

const fmt = (n: number, c: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c, minimumFractionDigits: 2 }).format(n);

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from), [t, setT] = useState(to);
  const go = (a: string, b: string) => router.push(`/platform/billing?from=${a}&to=${b}`);
  const shift = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const now = new Date().toISOString().slice(0, 7);
  return (
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <div><label className="label" htmlFor="from">From month</label><input id="from" type="month" className="input w-40" value={f} onChange={(e) => setF(e.target.value)} /></div>
      <div><label className="label" htmlFor="to">To month</label><input id="to" type="month" className="input w-40" value={t} onChange={(e) => setT(e.target.value)} /></div>
      <button className="btn-primary" onClick={() => go(f, t < f ? f : t)}>Calculate</button>
      <div className="flex gap-1">
        <button className="btn-ghost btn-sm" onClick={() => go(shift(now, -1), shift(now, -1))}>Last month</button>
        <button className="btn-ghost btn-sm" onClick={() => go(now, now)}>This month</button>
        <button className="btn-ghost btn-sm" onClick={() => go(shift(now, -2), now)}>Last 3 months</button>
      </div>
    </div>
  );
}

export function BillingTable({ rows, currency, from, to, totals, taxPct, openContract }:
  { rows: BillRow[]; currency: string; from: string; to: string; totals: { billed: number; subtotal: number; discount: number; tax: number; total: number }; taxPct: number; openContract?: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<string | null>(openContract ?? null);
  const h = rows.find((r) => r.id === edit) ?? null;
  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2 print:hidden">
        <a className="btn-secondary btn-sm" href={`/platform/billing-export?from=${from}&to=${to}`}><Download className="h-4 w-4" /> Download CSV</a>
        <button className="btn-secondary btn-sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
      </div>
      <div className="overflow-x-auto">
        <table className="table [&_td]:whitespace-nowrap">
          <thead><tr><th>Hotel</th><th>Contract</th><th className="text-right">Form types billed</th>
            <th className="text-right">Subtotal</th><th className="text-right">Discount</th><th className="text-right">Tax {taxPct ? `(${taxPct}%)` : ""}</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={clsx(!r.active && "opacity-70")}>
                  <td><button className="flex items-start gap-1 text-left" onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })} aria-expanded={!!open[r.id]}>
                    {open[r.id] ? <ChevronDown className="mt-0.5 h-4 w-4 text-ink-mute" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-ink-mute" />}
                    <span><span className="font-medium">{r.name}</span><span className="block text-xs text-ink-mute"><span className="font-mono">{r.code}</span> · {r.activeNow} enabled now{!r.active && " · suspended"}</span></span></button></td>
                  <td className="text-sm">{r.contract?.contract_no ? <span className="font-mono">{r.contract.contract_no}</span> : r.contract ? <span className="text-ink-mute">No number</span> : null}
                    {r.contract && <span className="block text-xs text-ink-mute">{r.contract.cycle.charAt(0).toUpperCase() + r.contract.cycle.slice(1)}{r.contract.discount_pct > 0 ? ` · ${r.contract.discount_pct}% off` : ""}</span>}
                    <button className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline print:hidden" onClick={() => setEdit(r.id)} aria-label={`Contract for ${r.name}`}><FileSignature className="h-3 w-3" /> {r.contract ? "Edit contract" : "Add contract"}</button></td>
                  <td className="text-right tabular-nums"><span className="font-semibold">{r.forms.length}</span><span className="block text-xs text-ink-mute">{r.billed.toFixed(2)} form-months · {r.formDays} days</span></td>
                  <td className="text-right tabular-nums">{fmt(r.subtotal, currency)}<span className="block text-xs text-ink-mute">@ {fmt(r.rate, currency)}{r.contract?.rate_per_form != null ? " contract" : ""}</span></td>
                  <td className="text-right tabular-nums">{r.discount ? `− ${fmt(r.discount, currency)}` : "—"}</td>
                  <td className="text-right tabular-nums">{fmt(r.tax, currency)}</td>
                  <td className="text-right font-semibold tabular-nums">{fmt(r.total, currency)}{r.minimumApplied && <span className="block text-xs font-normal text-amber-700">minimum {fmt(r.minimum, currency)}</span>}</td>
                </tr>
                {open[r.id] && (
                  <tr className="bg-ink-wash/40"><td colSpan={7} className="px-10 py-3">
                    {r.forms.length === 0 ? <p className="text-sm text-ink-mute">No active forms in this period.</p> : (
                      <ul className="grid gap-x-8 gap-y-1 whitespace-normal text-sm lg:grid-cols-2">{r.forms.map((f) => (
                        <li key={f.id} className="flex justify-between gap-3"><span>{f.title}</span>
                          <span className="text-xs text-ink-mute">{f.activeNow ? "enabled now" : "disabled / removed"} · {f.days} day{f.days === 1 ? "" : "s"} · {f.formMonths.toFixed(2)} form-months</span></li>))}</ul>)}
                  </td></tr>)}
              </Fragment>))}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={2}>Total · {rows.length} hotels</td><td className="text-right tabular-nums">{totals.billed.toFixed(2)}<span className="block text-xs font-normal text-ink-mute">form-months</span></td>
            <td className="text-right tabular-nums">{fmt(totals.subtotal, currency)}</td><td className="text-right tabular-nums">{totals.discount ? `− ${fmt(totals.discount, currency)}` : "—"}</td>
            <td className="text-right tabular-nums">{fmt(totals.tax, currency)}</td><td className="text-right tabular-nums">{fmt(totals.total, currency)}</td></tr></tfoot>
        </table>
      </div>
      {h && <ContractPanel key={h.id} row={h} currency={currency} onClose={() => setEdit(null)} />}
    </>
  );
}

function ContractPanel({ row, currency, onClose }: { row: BillRow; currency: string; onClose: () => void }) {
  const [state, run] = useActionState(saveContract.bind(null, row.id), undefined);
  const router = useRouter();
  const c = row.contract;
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[2px] print:hidden" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Contract for ${row.name}`}>
      <form action={run} className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-ink-line px-5 py-4">
          <div className="flex-1"><h2 className="text-lg font-semibold">Contract · {row.name}</h2>
            <p className="text-sm text-ink-mute"><span className="font-mono">{row.code}</span> · {row.activeNow} form type{row.activeNow === 1 ? "" : "s"} enabled now{row.ends ? ` · subscription ends ${row.ends}` : ""}</p></div>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          {state?.ok && <Alert kind="success">{state.ok}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="cno">Contract number</label><input id="cno" name="contract_no" className="input font-mono" defaultValue={c?.contract_no ?? ""} placeholder="e.g. VS-2026-014" /></div>
            <div><label className="label" htmlFor="cstart">Start date</label><input id="cstart" name="starts_on" type="date" className="input" defaultValue={c?.starts_on ?? ""} /></div>
            <div><label className="label" htmlFor="ccycle">Billing cycle</label>
              <select id="ccycle" name="cycle" className="input" defaultValue={c?.cycle ?? "monthly"}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></div>
            <div><label className="label" htmlFor="cdisc">Discount %</label><input id="cdisc" name="discount" inputMode="decimal" className="input" defaultValue={c?.discount_pct ? String(c.discount_pct) : ""} placeholder="0" /></div>
            <div><label className="label" htmlFor="crate">Rate per form type / month <span className="font-normal text-ink-mute">({currency})</span></label>
              <input id="crate" name="rate" inputMode="decimal" className="input" defaultValue={c?.rate_per_form != null ? String(c.rate_per_form) : ""} placeholder="Default pricing" /></div>
            <div><label className="label" htmlFor="cmin">Minimum per month <span className="font-normal text-ink-mute">({currency})</span></label>
              <input id="cmin" name="minimum" inputMode="decimal" className="input" defaultValue={c?.minimum_monthly != null ? String(c.minimum_monthly) : ""} placeholder="Default pricing" /></div>
            <div><label className="label" htmlFor="cname">Billing contact</label><input id="cname" name="contact_name" className="input" defaultValue={c?.contact_name ?? ""} /></div>
            <div><label className="label" htmlFor="cemail">Billing e-mail</label><input id="cemail" name="contact_email" type="email" className="input" defaultValue={c?.contact_email ?? ""} /></div>
          </div>
          <p className="help">Leave rate or minimum empty to use the default pricing. The contract end is the hotel&apos;s subscription end date (Hotels → Edit).</p>
          <div><label className="label" htmlFor="cnotes">Notes</label><textarea id="cnotes" name="notes" rows={3} className="input" defaultValue={c?.notes ?? ""} placeholder="Payment terms, PO number…" /></div>
        </div>
        <div className="flex gap-2 border-t border-ink-line px-5 py-4"><SubmitButton className="btn-primary">Save contract</SubmitButton><button type="button" className="btn-ghost" onClick={onClose}>Close</button></div>
      </form>
    </div>
  );
}

export function PricingForm({ currencies, s }: { currencies: string[]; s: BillingSettings }) {
  const [state, run] = useActionState(saveBillingSettings, undefined);
  return (
    <form action={run} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-4">
        <div><label className="label" htmlFor="pcur">Currency</label><select id="pcur" name="currency" className="input" defaultValue={s.currency}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="prate">Price per enabled form type / month</label><input id="prate" name="rate" inputMode="decimal" className="input" defaultValue={s.rate_per_form.toFixed(2)} required /></div>
        <div><label className="label" htmlFor="pmin">Minimum per hotel / month</label><input id="pmin" name="minimum" inputMode="decimal" className="input" defaultValue={s.minimum_monthly.toFixed(2)} required /></div>
        <div><label className="label" htmlFor="ptax">Tax %</label><input id="ptax" name="tax" inputMode="decimal" className="input" defaultValue={String(s.tax_pct)} required /></div>
      </div>
      <SubmitButton className="btn-secondary">Save pricing</SubmitButton>
    </form>
  );
}
