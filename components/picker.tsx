"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Users, User, X } from "lucide-react";

export interface PickOption { key: string; label: string; sub?: string; kind: "user" | "group" }

/** Searchable multi-select dropdown. */
export function Picker({ options, selected, onChange, placeholder = "Search people or groups…", emptyText = "No matches" }:
  { options: PickOption[]; selected: string[]; onChange: (keys: string[]) => void; placeholder?: string; emptyText?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return options.filter((o) => !selected.includes(o.key) && (!s || o.label.toLowerCase().includes(s) || (o.sub ?? "").toLowerCase().includes(s))).slice(0, 50);
  }, [q, options, selected]);
  const byKey = new Map(options.map((o) => [o.key, o]));
  return (
    <div ref={box} className="relative">
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-ink-line bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200" onClick={() => setOpen(true)}>
        {selected.map((k) => { const o = byKey.get(k); if (!o) return null; return (
          <span key={k} className="badge bg-brand-50 py-1 text-brand-800 ring-1 ring-brand-200">
            {o.kind === "group" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}{o.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selected.filter((x) => x !== k)); }} aria-label={`Remove ${o.label}`}><X className="h-3 w-3" /></button>
          </span>); })}
        <div className="flex min-w-[140px] flex-1 items-center gap-1">
          <Search className="h-4 w-4 text-ink-mute" />
          <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Tab") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (list[0]) { onChange([...selected, list[0].key]); setQ(""); } } }} placeholder={selected.length ? "" : placeholder} className="w-full border-0 bg-transparent py-0.5 text-sm outline-none" />
        </div>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-line bg-white py-1 shadow-lg">
          {list.length === 0 ? <p className="px-3 py-2 text-sm text-ink-mute">{emptyText}</p> : list.map((o) => (
            <button type="button" key={o.key} onClick={() => { onChange([...selected, o.key]); setQ(""); inp.current?.focus(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50">
              {o.kind === "group" ? <Users className="h-4 w-4 text-brand-600" /> : <User className="h-4 w-4 text-ink-mute" />}
              <span className="font-medium">{o.label}</span>{o.sub && <span className="truncate text-xs text-ink-mute">{o.sub}</span>}
            </button>))}
        </div>)}
    </div>
  );
}
