"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Layers, Unlink } from "lucide-react";
import { Alert } from "@/components/ui";
import { groupHotels, ungroupHotels } from "@/app/actions/platform";
import { SubBadge, type SubState } from "./status";
import { SubscriptionPanel, HotelDetails, AdminAccounts, DangerZone, PlanPanel } from "./panels";

export type HotelRow = {
  id: string; property_code: string; name: string; notes: string | null; active: boolean; ends: string | null; endsLabel: string | null; days_left: number | null;
  state: SubState; users: number; forms: number; activeForms: number; group: string | null; clusterUsers: number; limit: number | null; tz: string; tzLabel: string; subs: number; last_seen: string | null; storage: string;
  admins: { id: string; username: string; name: string; email: string | null; active: boolean; must_change_password: boolean; locked: boolean; totp: boolean; last_seen: string | null }[];
};

/** Hotels list; "Edit" opens everything for that hotel in a side panel on the same page. */
export function HotelTable({ rows, initialEdit, zones, groups }: { rows: HotelRow[]; initialEdit?: string; zones: { value: string; label: string }[]; groups: string[] }) {
  const [editId, setEditId] = useState<string | null>(initialEdit ?? null);
  const [picked, setPicked] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const [gname, setGname] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, start] = useTransition();
  const allOn = rows.length > 0 && picked.length === rows.length;
  const doGroup = () => start(async () => {
    const r = await groupHotels(picked, gname);
    if ("error" in r && r.error) { setMsg({ kind: "error", text: r.error }); return; }
    setMsg({ kind: "success", text: `${picked.length} hotel${picked.length === 1 ? "" : "s"} grouped in “${gname.trim()}”. Their admins can now give users access across the group.` });
    setPicked([]); setNaming(false); setGname(""); router.refresh();
  });
  const doUngroup = () => start(async () => {
    const r = await ungroupHotels(picked);
    setMsg({ kind: "success", text: `${"count" in r ? r.count : 0} hotel${("count" in r ? r.count : 0) === 1 ? "" : "s"} ungrouped — cluster access to them has stopped.` });
    setPicked([]); router.refresh();
  });
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
      {msg && <div className="mb-3"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {picked.length > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          <b>{picked.length} selected</b>
          {!naming ? (<>
            <button className="btn-sm btn bg-white text-slate-900 hover:bg-slate-100" disabled={busy} onClick={() => setNaming(true)}><Layers className="h-4 w-4" /> Group…</button>
            <button className="btn-sm btn bg-white/10 text-white hover:bg-white/20" disabled={busy} onClick={doUngroup}><Unlink className="h-4 w-4" /> Ungroup</button>
          </>) : (<>
            <input autoFocus list="group-names" className="input w-56 py-1.5 text-ink" placeholder="Group name, e.g. Lagoon Collection" value={gname} onChange={(e) => setGname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doGroup()} aria-label="Group name" />
            <datalist id="group-names">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <button className="btn-sm btn bg-cyan-400 text-slate-900 hover:bg-cyan-300" disabled={busy || !gname.trim()} onClick={doGroup}>Group {picked.length}</button>
            <button className="btn-sm btn text-white/80 hover:text-white" onClick={() => setNaming(false)}>Cancel</button>
            {groups.length > 0 && <span className="text-xs text-white/60">Pick an existing name to add to that group.</span>}
          </>)}
          <button className="btn-sm btn ml-auto text-white/70 hover:text-white" onClick={() => { setPicked([]); setNaming(false); }}>Clear</button>
        </div>)}
      <div className="card mb-8 overflow-x-auto">
        <table className="table">
          <thead><tr><th className="w-8"><input type="checkbox" aria-label="Select all hotels" checked={allOn} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /></th><th>Hotel</th><th>Subscription</th><th>Ends</th><th>Admin</th><th className="text-right">Users</th><th className="text-right" title="Enabled form types / allowed by the plan — billed per enabled form type per day; submissions unlimited">Form types</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-ink-mute">No hotels here.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className={picked.includes(p.id) ? "bg-brand-50/60" : undefined}>
                <td><input type="checkbox" aria-label={`Select ${p.name}`} checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} /></td>
                <td><p className="font-medium">{p.name}{p.group && <span className="badge ml-2 bg-violet-50 align-middle text-violet-800 ring-1 ring-violet-200" title={`${p.clusterUsers} cluster user${p.clusterUsers === 1 ? "" : "s"} from other hotels`}><Layers className="h-3 w-3" /> {p.group}</span>}</p><p className="text-xs text-ink-mute"><span className="font-mono">{p.property_code}</span> · {p.tzLabel}</p></td>
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
              <HotelDetails key={`d-${h.id}`} id={h.id} name={h.name} notes={h.notes ?? ""} tz={h.tz} zones={zones} />
              <DangerZone id={h.id} code={h.property_code} name={h.name} counts={{ users: h.users, forms: h.forms, subs: h.subs }} onDeleted={() => setEditId(null)} />
            </div>
          </div>
        </div>)}
    </>
  );
}
