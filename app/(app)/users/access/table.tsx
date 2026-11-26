"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { setFeature, type Feature } from "@/app/actions/users";

interface Row { id: string; name: string; username: string; department: string | null; is_admin: boolean; can_build_forms: boolean; can_use_studio: boolean; can_use_ai: boolean }

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-brand-600" : "bg-ink-line")}>
      <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function FeatureTable({ users }: { users: Row[] }) {
  const [rows, setRows] = useState(users);
  const [q, setQ] = useState("");
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  function toggle(r: Row, f: Feature, on: boolean) {
    // mirror the server rules: studio/AI need the designer; switching the designer off switches them off
    const next = { ...r };
    if (f === "build") { next.can_build_forms = on; if (!on) { next.can_use_studio = false; next.can_use_ai = false; } }
    if (f === "studio") { next.can_use_studio = on; if (on) next.can_build_forms = true; else next.can_use_ai = false; }
    if (f === "ai") { next.can_use_ai = on; if (on) { next.can_use_studio = true; next.can_build_forms = true; } }
    setRows((rs) => rs.map((x) => (x.id === r.id ? next : x)));
    start(async () => { await setFeature(r.id, f, on); setSaved(r.name); });
  }
  const shown = rows.filter((r) => !q || `${r.name} ${r.username} ${r.department ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <span className="text-xs text-ink-mute">{saving ? "Saving…" : saved ? `Saved for ${saved}` : ""}</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Person</th><th>Form designer</th><th>Form Studio</th><th>AI design</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id}>
              <td><p className="font-medium">{r.name}</p><p className="text-xs text-ink-mute">@{r.username}{r.department ? ` · ${r.department}` : ""}</p></td>
              {r.is_admin ? <td colSpan={3}><span className="badge bg-brand-50 text-brand-700">Admin — all features</span></td> : (<>
                <td><Switch label={`Form designer for ${r.name}`} on={r.can_build_forms} onChange={(v) => toggle(r, "build", v)} /></td>
                <td><Switch label={`Form Studio for ${r.name}`} on={r.can_use_studio} onChange={(v) => toggle(r, "studio", v)} /></td>
                <td><Switch label={`AI design for ${r.name}`} on={r.can_use_ai} onChange={(v) => toggle(r, "ai", v)} /></td>
              </>)}
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
