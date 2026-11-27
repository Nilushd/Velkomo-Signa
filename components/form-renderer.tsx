"use client";
import { useState } from "react";
import clsx from "clsx";
import { headerLogo, LOGO_HEIGHT, type Field, type Theme, type FileRef } from "@/lib/types";
import { fileRefs } from "@/lib/format";
import { Paperclip, X, Camera } from "lucide-react";
import { SignaturePad } from "./signature-pad";

/**
 * Phone photos are often 3–8 MB. Resize big JPEG/PNG/WebP photos to at most 2000 px (JPEG, good quality) before
 * uploading: faster on mobile data, and they stay under the 10 MB limit. Other files are sent as they are.
 */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000 || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

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
  /** the hotel / property, for the header */
  propertyName?: string;
  propertyLogo?: string | null;
}

/** Form header: logo (hotel or custom), hotel name, title, form code. Shared by the form and the builder previews. */
export function FormHeader({ theme, title, propertyName, propertyLogo }: { theme: Theme; title: string; propertyName?: string; propertyLogo?: string | null }) {
  const logo = headerLogo(theme, propertyLogo);
  const align = theme.logoAlign ?? "left";
  const box = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={clsx("flex flex-col gap-2", box)}>
      {(logo || (theme.showPropertyName && propertyName)) && (
        <div className={clsx("flex items-center gap-3", align === "right" && "flex-row-reverse")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={`/api/files/${logo}`} alt="" style={{ height: LOGO_HEIGHT[theme.logoSize ?? "m"] }} className="w-auto max-w-[260px] object-contain" />}
          {theme.showPropertyName && propertyName && <span className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{propertyName}</span>}
        </div>)}
      <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "inherit" }}>{title}</h1>
      {theme.formCode && <p className="font-mono text-xs text-ink-mute">{theme.formCode}</p>}
    </div>
  );
}

export function FormRenderer({ title, description, schema, theme, initial, submitLabel = "Submit", uploadCode, preview, onSubmit, footer, header, propertyName, propertyLogo }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const primary = theme.primary || "#2563EB";
  const set = (id: string, v: unknown) => { setData((d) => ({ ...d, [id]: v })); setErrors((e) => { const n = { ...e }; delete n[id]; return n; }); };

  async function upload(f: Field, picked: File[]) {
    if (!uploadCode || picked.length === 0) return;
    const files = await Promise.all(picked.map(shrinkPhoto));
    const max = f.multiple ? f.maxFiles || 5 : 1;
    const current = f.multiple ? fileRefs(data[f.id]) : [];
    if (current.length + files.length > max) { setErrors((e) => ({ ...e, [f.id]: `You can attach at most ${max} files.` })); return; }
    const big = files.find((x) => x.size > 10 * 1024 * 1024);
    if (big) { setErrors((e) => ({ ...e, [f.id]: `${big.name} is larger than 10 MB.` })); return; }
    setUploading(f.id);
    try {
      const done: FileRef[] = [];
      for (const file of files) {
        const fd = new FormData(); fd.append("file", file); fd.append("code", uploadCode);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(`${file.name}: ${j.error || "upload failed"}`);
        done.push(j as FileRef);
      }
      set(f.id, f.multiple ? [...current, ...done] : done[0]);
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
          <FormHeader theme={theme} title={title} propertyName={propertyName} propertyLogo={propertyLogo} />
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
                {f.type === "file" && (() => {
                  const refs = fileRefs(v);
                  const max = f.multiple ? f.maxFiles || 5 : 1;
                  const full = f.multiple && refs.length >= max;
                  return (
                    <div id={`fld-${f.id}`} className="space-y-2">
                      {refs.length > 0 && <ul className="space-y-1.5">{refs.map((r) => (
                        <li key={r.fileId} className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink-wash/50 px-3 py-2 text-sm">
                          <Paperclip className="h-4 w-4 shrink-0 text-ink-mute" /><span className="min-w-0 flex-1 truncate">{r.name}</span>
                          <span className="shrink-0 text-xs text-ink-mute">{Math.max(1, Math.round(r.size / 1024))} KB</span>
                          <button type="button" onClick={() => set(f.id, f.multiple ? refs.filter((x) => x.fileId !== r.fileId) : "")} className="text-ink-mute hover:text-red-600" aria-label={`Remove ${r.name}`}><X className="h-4 w-4" /></button>
                        </li>))}</ul>}
                      {!full && (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* phones: open the camera straight away */}
                          <label className={clsx("btn-secondary cursor-pointer sm:hidden", (preview || uploading) && "pointer-events-none opacity-60")}>
                            <Camera className="h-4 w-4" /> Take photo
                            <input type="file" className="sr-only" disabled={preview} accept="image/*" capture="environment"
                              onChange={(e) => { const list = Array.from(e.target.files ?? []); e.target.value = ""; upload(f, list); }} />
                          </label>
                          <label className={clsx("btn-secondary cursor-pointer", (preview || uploading) && "pointer-events-none opacity-60")}>
                            <Paperclip className="h-4 w-4" />
                            {uploading === f.id ? "Uploading…" : f.multiple ? (refs.length ? "Add more files" : "Add files") : refs.length ? "Replace file" : "Choose file"}
                            <input type="file" className="sr-only" disabled={preview} multiple={!!f.multiple} accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"
                              onChange={(e) => { const list = Array.from(e.target.files ?? []); e.target.value = ""; upload(f, list); }} />
                          </label>
                          <span className="w-full text-xs text-ink-mute sm:w-auto">PDF, photo, Word or Excel · max 10 MB each{f.multiple ? ` · up to ${max} files` : ""}</span>
                        </div>)}
                    </div>);
                })()}
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
