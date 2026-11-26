"use client";
import { useState } from "react";
import clsx from "clsx";
import type { Field, Theme, FileRef } from "@/lib/types";
import { SignaturePad } from "./signature-pad";

export const FONT_STACKS: Record<string, string> = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
};

interface Props {
  title: string;
  description?: string;
  schema: Field[];
  theme: Theme;
  initial?: Record<string, unknown>;
  submitLabel?: string;
  /** form short code, needed for file uploads; omit in preview */
  uploadCode?: string;
  preview?: boolean;
  onSubmit?: (data: Record<string, unknown>) => Promise<{ error?: string; fieldErrors?: Record<string, string> } | void>;
  footer?: React.ReactNode;
  header?: React.ReactNode;
}

export function FormRenderer({ title, description, schema, theme, initial, submitLabel = "Submit", uploadCode, preview, onSubmit, footer, header }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const primary = theme.primary || "#2563EB";
  const set = (id: string, v: unknown) => { setData((d) => ({ ...d, [id]: v })); setErrors((e) => { const n = { ...e }; delete n[id]; return n; }); };

  async function upload(f: Field, file: File) {
    if (!uploadCode) return;
    if (file.size > 10 * 1024 * 1024) { setErrors((e) => ({ ...e, [f.id]: "Files can be at most 10 MB." })); return; }
    setUploading(f.id);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("code", uploadCode);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      set(f.id, j as FileRef);
    } catch (e) {
      setErrors((x) => ({ ...x, [f.id]: e instanceof Error ? e.message : "Upload failed" }));
    } finally { setUploading(null); }
  }

  function check() {
    const errs: Record<string, string> = {};
    for (const f of schema) {
      if (!f.required || f.type === "heading") continue;
      const v = data[f.id];
      if (v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0)) errs[f.id] = "This field is required.";
    }
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview || !onSubmit) return;
    const errs = check();
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError("Please fill in the required fields."); document.getElementById(`fld-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setBusy(true); setFormError(null);
    try {
      const r = await onSubmit(data);
      if (r?.error) setFormError(r.error);
      if (r?.fieldErrors) setErrors(r.fieldErrors);
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      setFormError("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  const inputStyle = { "--tw-ring-color": primary + "33" } as React.CSSProperties;

  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-2xl" style={{ fontFamily: FONT_STACKS[theme.font ?? "sans"] }}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <div className="h-2" style={{ background: primary }} />
        <div className="px-5 pb-2 pt-6 sm:px-8">
          {theme.logoFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${theme.logoFileId}`} alt="" className="mb-4 max-h-14 w-auto" />
          )}
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "inherit" }}>{title}</h1>
          {description && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{description}</p>}
          {header}
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-8">
          {schema.length === 0 && <p className="text-sm text-ink-mute">No fields yet.</p>}
          {schema.map((f) => {
            if (f.type === "heading") return (
              <div key={f.id} className="border-b pt-2" style={{ borderColor: primary + "40" }}>
                <h2 className="pb-1 text-lg font-semibold" style={{ color: primary, fontFamily: "inherit" }}>{f.label}</h2>
                {f.help && <p className="pb-2 text-sm text-ink-mute">{f.help}</p>}
              </div>);
            const err = errors[f.id];
            const v = data[f.id];
            const common = { id: `fld-${f.id}`, className: clsx("input", err && "border-red-400"), style: inputStyle, placeholder: f.placeholder, disabled: preview && false };
            return (
              <div key={f.id}>
                {f.type !== "checkbox" || (f.options && f.options.length) ? (
                  <label htmlFor={`fld-${f.id}`} className="label">{f.label}{f.required && <span className="text-red-600"> *</span>}</label>
                ) : null}
                {f.type === "text" && <input type="text" {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
                {f.type === "email" && <input type="email" inputMode="email" autoComplete="email" {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
                {f.type === "phone" && <input type="tel" inputMode="tel" autoComplete="tel" {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
                {f.type === "number" && <input type="number" inputMode="decimal" step="any" {...common} value={v === undefined || v === null ? "" : String(v)} onChange={(e) => set(f.id, e.target.value === "" ? "" : Number(e.target.value))} />}
                {f.type === "date" && <input type="date" {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
                {f.type === "textarea" && <textarea rows={4} {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
                {f.type === "select" && (
                  <select {...common} value={String(v ?? "")} onChange={(e) => set(f.id, e.target.value)}>
                    <option value="">{f.placeholder || "Choose…"}</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>)}
                {f.type === "radio" && (
                  <div id={`fld-${f.id}`} className="space-y-2">{(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm"><input type="radio" name={f.id} checked={v === o} onChange={() => set(f.id, o)} style={{ accentColor: primary }} /> {o}</label>))}</div>)}
                {f.type === "checkbox" && (f.options && f.options.length ? (
                  <div id={`fld-${f.id}`} className="space-y-2">{f.options.map((o) => {
                    const arr = Array.isArray(v) ? (v as string[]) : [];
                    return <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arr.includes(o)} style={{ accentColor: primary }}
                      onChange={(e) => set(f.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} /> {o}</label>;
                  })}</div>
                ) : (
                  <label id={`fld-${f.id}`} className="flex items-center gap-2 text-sm font-medium text-ink-soft"><input type="checkbox" checked={v === true} style={{ accentColor: primary }} onChange={(e) => set(f.id, e.target.checked)} />
                    {f.label}{f.required && <span className="text-red-600"> *</span>}</label>))}
                {f.type === "file" && (
                  <div id={`fld-${f.id}`} className="flex flex-wrap items-center gap-3">
                    <label className={clsx("btn-secondary cursor-pointer", (preview || uploading) && "pointer-events-none opacity-60")}>
                      {uploading === f.id ? "Uploading…" : v ? "Replace file" : "Choose file"}
                      <input type="file" className="sr-only" disabled={preview} accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        onChange={(e) => e.target.files?.[0] && upload(f, e.target.files[0])} />
                    </label>
                    {v ? <span className="text-sm text-ink-soft">{(v as FileRef).name}</span> : <span className="text-xs text-ink-mute">PDF, image, Word or Excel · max 10 MB</span>}
                  </div>)}
                {f.type === "signature" && <SignaturePad value={typeof v === "string" ? v : undefined} onChange={(s) => set(f.id, s)} disabled={preview} />}
                {f.help && <p className="help">{f.help}</p>}
                {err && <p className="mt-1 text-xs font-medium text-red-600">{err}</p>}
              </div>
            );
          })}
        </div>
        <div className="border-t border-ink-line bg-ink-wash/50 px-5 py-4 sm:px-8">
          {formError && <p className="mb-3 text-sm font-medium text-red-600">{formError}</p>}
          {footer}
          <button type="submit" disabled={busy || preview || !!uploading} className="btn w-full py-3 text-base text-white shadow-sm sm:w-auto sm:px-8" style={{ background: primary }}>
            {busy ? "Sending…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
