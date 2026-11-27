import { rootSql } from "./db";

/**
 * Hotels are billed per enabled form type, per day: each form costs (monthly rate ÷ days in that month) for every day it was enabled.
 * Hotel admins can disable forms they don't need — disabled and draft forms cost nothing. Usage is recorded daily (cron + on every enable).
 */
export type BillingSettings = { currency: string; rate_per_form: number; minimum_monthly: number; tax_pct: number };
export type Contract = { contract_no: string | null; starts_on: string | null; cycle: "monthly" | "quarterly" | "annual"; rate_per_form: number | null;
  minimum_monthly: number | null; discount_pct: number; contact_name: string | null; contact_email: string | null; notes: string | null };
export type BillRow = {
  id: string; code: string; name: string; active: boolean; ends: string | null; contract: Contract | null;
  activeNow: number; forms: { id: string; title: string; days: number; formMonths: number; activeNow: boolean }[];
  billed: number; formDays: number; rate: number; months: number; subtotal: number; discount: number; minimum: number; minimumApplied: boolean; tax: number; total: number;
};

export const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "INR", "AED", "MVR"];
export const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function billingSettings(): Promise<BillingSettings> {
  const [s] = await rootSql()<BillingSettings[]>`select currency, rate_per_form, minimum_monthly, tax_pct from billing_settings where id = 1`;
  return { currency: s?.currency ?? "LKR", rate_per_form: Number(s?.rate_per_form ?? 0), minimum_monthly: Number(s?.minimum_monthly ?? 0), tax_pct: Number(s?.tax_pct ?? 0) };
}

/** "2026-11" → first and last day, and how many months from..to covers. */
export function periodOf(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number), [ty, tm] = to.split("-").map(Number);
  const months = (ty - fy) * 12 + (tm - fm) + 1;
  const start = `${from}-01`;
  const end = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
  return { start, end, months };
}

/** The bill for every hotel for whole months from..to (inclusive). Forms count if active on any day of the period. */
export async function computeBilling(from: string, to: string) {
  const settings = await billingSettings();
  const { start, end, months } = periodOf(from, to);
  const sql = rootSql();
  const hotels = await sql<{ id: string; code: string; name: string; active: boolean; ends: string | null }[]>`
    select id, property_code as code, name, active, to_char(subscription_ends, 'YYYY-MM-DD') as ends from properties order by name`;
  const contracts = await sql<(Contract & { property_id: string })[]>`
    select property_id, contract_no, to_char(starts_on, 'YYYY-MM-DD') as starts_on, cycle, rate_per_form, minimum_monthly, discount_pct, contact_name, contact_email, notes from hotel_contracts`;
  const used = await sql<{ property_id: string; form_id: string; title: string; days: number; fm: string; active_now: boolean }[]>`
    select u.property_id, u.form_id, (array_agg(u.title order by u.day desc))[1] as title, count(*)::int as days,
      sum(1.0 / extract(day from (date_trunc('month', u.day) + interval '1 month - 1 day')))::numeric(12,6) as fm,
      exists (select 1 from forms f where f.id = u.form_id and f.status = 'published') as active_now
    from form_usage u where u.day between ${start}::date and ${end}::date group by u.property_id, u.form_id`;
  const now = await sql<{ property_id: string; n: number }[]>`select property_id, count(*)::int as n from forms where status = 'published' group by property_id`;
  const rows: BillRow[] = hotels.map((h) => {
    const c0 = contracts.find((c) => c.property_id === h.id);
    const contract: Contract | null = c0 ? { ...c0, rate_per_form: num(c0.rate_per_form), minimum_monthly: num(c0.minimum_monthly), discount_pct: Number(c0.discount_pct) } : null;
    const forms = used.filter((u) => u.property_id === h.id).map((u) => ({ id: u.form_id, title: u.title, days: u.days, formMonths: Number(u.fm), activeNow: u.active_now }))
      .sort((a, b) => a.title.localeCompare(b.title));
    const rate = contract?.rate_per_form ?? settings.rate_per_form;
    // form-months: 1.00 = one form enabled for a whole month
    const billed = Math.round(forms.reduce((t, f) => t + f.formMonths, 0) * 100) / 100;
    const formDays = forms.reduce((t, f) => t + f.days, 0);
    const subtotal = r2(forms.reduce((t, f) => t + f.formMonths, 0) * rate);
    const discount = r2(subtotal * (contract?.discount_pct ?? 0) / 100);
    const minimum = r2((contract?.minimum_monthly ?? settings.minimum_monthly) * months);
    const net = subtotal - discount;
    const minimumApplied = minimum > net;
    const charge = Math.max(net, minimum);
    const tax = r2(charge * settings.tax_pct / 100);
    return { id: h.id, code: h.code, name: h.name, active: h.active, ends: h.ends, contract, activeNow: now.find((n) => n.property_id === h.id)?.n ?? 0,
      forms, billed, formDays, rate, months, subtotal, discount, minimum, minimumApplied, tax, total: r2(charge + tax) };
  });
  const totals = rows.reduce((t, r) => ({ billed: Math.round((t.billed + r.billed) * 100) / 100, subtotal: t.subtotal + r.subtotal, discount: t.discount + r.discount, tax: t.tax + r.tax, total: t.total + r.total }),
    { billed: 0, subtotal: 0, discount: 0, tax: 0, total: 0 });
  const today = new Date().toISOString().slice(0, 10);
  return { settings, start, end, months, rows, toDate: today >= start && today <= end ? today : null, totals: { ...totals, subtotal: r2(totals.subtotal), discount: r2(totals.discount), tax: r2(totals.tax), total: r2(totals.total) } };
}

/** Cron: record today's active forms (the trigger records publishes; this covers forms that stay published). */
export async function recordFormUsage() {
  const r = await rootSql()`insert into form_usage (property_id, form_id, day, title)
    select property_id, id, signa_today(property_id), title from forms where status = 'published' on conflict (form_id, day) do nothing`;
  return r.count;
}
