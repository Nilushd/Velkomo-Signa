"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { SubBadge, type SubState } from "./status";
import { SubscriptionPanel, HotelDetails, AdminAccounts, DangerZone, PlanPanel } from "./panels";

export type HotelRow = {
  id: string; property_code: string; name: string; notes: string | null; active: boolean; ends: string | null; endsLabel: string | null; days_left: number | null;
  state: SubState; users: number; forms: number; activeForms: number; limit: number | null; subs: number; last_seen: string | null; storage: string;
  admins: { id: string; username: string; name: string; email: string | null; active: boolean; must_change_password: boolean; locked: boolean; totp: boolean; last_seen: string | null }[];
};

/** Hotels list; "Edit" opens everything for that hotel in a side panel on the same page. */
export function HotelTable({ rows, initialEdit }: { rows: HotelRow[]; initialEdit?: string }) {
  const [editId, setEditId] = useState<string | null>(initialEdit ?? null);
  const router = useRouter();
  const h = rows.find((r) => r.id === editId) ?? null;
  const close = () => { setEditId(null); router.replace("/platform", { scroll: false }); };
  useEffect(() => {
    if (!h) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  return (
    <>
      <div className="card mb-8 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Hotel</th><th>Subscription</th><th>Ends</th><th>Admin</th><th className="text-right">Users</th><th className="text-right" title="Enabled form types / allowed by the plan — billed per enabled form type per day; submissions unlimited">Form types</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ink-mute">No hotels here.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-ink-mute">{p.property_code}</p></td>
                <td><SubBadge state={p.state} daysLeft={p.days_left} /></td>
                <td className="whitespace-nowrap">{p.endsLabel ?? <span className="text-ink-mute">—</span>}</td>
                <td className="text-sm">{p.admins.length ? <span className="font-mono">{p.admins.map((a) => a.username).join(", ")}</span> : <span className="text-red-600">no admin</span>}</td>
                <td className="text-right tabular-nums">{p.users}</td><td className="text-right tabular-nums"><span className={p.limit !== null && p.activeForms > p.limit ? "font-semibold text-red-700" : "font-semibold"}>{p.activeForms}</span><span className="text-ink-mute"> / {p.limit ?? "∞"}</span><span className="block text-xs text-ink-mute">enabled / allowed</span></td>
                <td className="whitespace-nowrap text-ink-mute">{p.last_seen ?? "Never"}</td>
                <td className="text-right"><button className="btn-secondary btn-sm" onClick={() => setEditId(p.id)} aria-label={`Edit ${p.name}`}><Pencil className="h-3.5 w-3.5" /> Edit</button></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {h && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[2px]" onClick={close} role="dialog" aria-modal="true" aria-label={`Edit ${h.name}`}>
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 border-b border-ink-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{h.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-mute"><span className="font-mono font-semibold text-ink">{h.property_code}</span><SubBadge state={h.state} daysLeft={h.days_left} />
                  <span>{h.users} user{h.users === 1 ? "" : "s"} · <b className="text-ink">{h.activeForms} of {h.limit ?? "unlimited"} form types enabled</b> · {h.storage}</span></p>
              </div>
              <button className="btn-ghost btn-sm" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 [&>*+*]:border-t [&>*+*]:border-ink-line [&>*+*]:pt-6">
              <SubscriptionPanel key={`s-${h.id}`} id={h.id} ends={h.ends} daysLeft={h.days_left} active={h.active} />
              <PlanPanel key={`p-${h.id}`} id={h.id} limit={h.limit} enabled={h.activeForms} />
              <AdminAccounts key={`a-${h.id}`} propertyId={h.id} code={h.property_code} admins={h.admins} />
              <section className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-ink-soft">Contract, rate and bills for this hotel</span>
                <a href={`/platform/billing?contract=${h.id}`} className="btn-secondary btn-sm">Contract &amp; billing</a></section>
              <HotelDetails key={`d-${h.id}`} id={h.id} name={h.name} notes={h.notes ?? ""} />
              <DangerZone id={h.id} code={h.property_code} name={h.name} counts={{ users: h.users, forms: h.forms, subs: h.subs }} onDeleted={() => setEditId(null)} />
            </div>
          </div>
        </div>)}
    </>
  );
}
