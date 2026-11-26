"use client";
import { useState } from "react";
import clsx from "clsx";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { headerLogo, type Field, type Theme } from "@/lib/types";
import { FormRenderer } from "../form-renderer";

const SWATCHES = ["#2563EB", "#0B1F4D", "#0891B2", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#475569"];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-ink-line bg-white p-0.5">
      {options.map((o) => <button key={o.v} type="button" title={o.title} onClick={() => onChange(o.v)}
        className={clsx("rounded-md px-3 py-1.5 text-sm font-medium", value === o.v ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-ink-wash")}>{o.label}</button>)}
    </div>
  );
}

export function ThemeTab({ theme, setTheme, title, description, schema, propertyName, propertyLogo }:
  { theme: Theme; setTheme: (t: Theme) => void; title: string; description: string; schema: Field[]; propertyName: string; propertyLogo: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Theme>) => setTheme({ ...theme, ...p });
  const source = theme.logoSource ?? (theme.logoFileId ? "custom" : "none");
  async function upload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("Choose an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setErr("Logos can be at most 2 MB."); return; }
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("purpose", "logo");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    setUploading(false);
    if (!r.ok) setErr(j.error ?? "Upload failed"); else set({ logoFileId: j.fileId, logoSource: "custom" });
  }
  const logo = headerLogo(theme, propertyLogo);
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Header &amp; logo</p>
          <div>
            <p className="label">Logo</p>
            <Seg value={source} onChange={(v) => set({ logoSource: v })} options={[{ v: "property", label: "Hotel logo" }, { v: "custom", label: "Upload" }, { v: "none", label: "None" }]} />
            {source === "property" && !propertyLogo && <p className="mt-2 text-xs text-amber-700">This property has no logo yet. An admin can add it in Settings → Property.</p>}
            {source === "custom" && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {theme.logoFileId ? <img src={`/api/files/${theme.logoFileId}`} alt="" className="h-12 max-w-[140px] rounded border border-ink-line object-contain p-1" /> : <div className="grid h-12 w-20 place-items-center rounded border border-dashed border-ink-line text-xs text-ink-mute">None</div>}
                <label className="btn-secondary btn-sm cursor-pointer">{uploading ? "Uploading…" : theme.logoFileId ? "Replace" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
              </div>)}
            {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </div>
          {source !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <div><p className="label">Position</p>
                <Seg value={theme.logoAlign ?? "left"} onChange={(v) => set({ logoAlign: v })} options={[
                  { v: "left", label: <AlignLeft className="h-4 w-4" />, title: "Left" }, { v: "center", label: <AlignCenter className="h-4 w-4" />, title: "Centre" }, { v: "right", label: <AlignRight className="h-4 w-4" />, title: "Right" }]} /></div>
              <div><p className="label">Size</p>
                <Seg value={theme.logoSize ?? "m"} onChange={(v) => set({ logoSize: v })} options={[{ v: "s", label: "S" }, { v: "m", label: "M" }, { v: "l", label: "L" }]} /></div>
            </div>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!theme.showPropertyName} onChange={(e) => set({ showPropertyName: e.target.checked })} /> Show hotel name ({propertyName})</label>
          <div><label className="label" htmlFor="fc">Form code <span className="font-normal text-ink-mute">(optional)</span></label>
            <input id="fc" className="input font-mono" value={theme.formCode ?? ""} maxLength={60} onChange={(e) => set({ formCode: e.target.value })} placeholder="e.g. HR-F-012 Rev 2" />
            <p className="help">Your document-control code, shown under the title and on printouts.</p></div>
        </div>
        <div className="card space-y-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Colours &amp; font</p>
          <div>
            <p className="label">Header colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => <button key={c} onClick={() => set({ primary: c })} className="h-7 w-7 rounded-full ring-2 ring-offset-2" style={{ background: c, ["--tw-ring-color" as string]: theme.primary === c ? c : "transparent" }} aria-label={c} />)}
              <input type="color" value={theme.primary ?? "#2563EB"} onChange={(e) => set({ primary: e.target.value.toUpperCase() })} className="h-8 w-10 cursor-pointer rounded border border-ink-line" aria-label="Custom colour" />
            </div>
          </div>
          <div>
            <p className="label">Background colour</p>
            <div className="flex items-center gap-2">
              {["#F4F7FC", "#FFFFFF", "#F8FAFC", "#FFF7ED", "#ECFEFF"].map((c) => <button key={c} onClick={() => set({ background: c })} className="h-7 w-7 rounded-full border border-ink-line ring-2 ring-offset-2" style={{ background: c, ["--tw-ring-color" as string]: theme.background === c ? "#2563EB" : "transparent" }} aria-label={c} />)}
              <input type="color" value={theme.background ?? "#F4F7FC"} onChange={(e) => set({ background: e.target.value.toUpperCase() })} className="h-8 w-10 cursor-pointer rounded border border-ink-line" aria-label="Custom background" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="font">Font</label>
            <select id="font" className="input" value={theme.font ?? "sans"} onChange={(e) => set({ font: e.target.value as Theme["font"] })}>
              <option value="sans">Modern (sans-serif)</option><option value="serif">Classic (serif)</option><option value="rounded">Friendly (rounded)</option>
            </select>
          </div>
        </div>
        <div className="card space-y-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Messages &amp; print</p>
          <div><label className="label" htmlFor="ty">Thank-you message</label>
            <textarea id="ty" rows={3} className="input" value={theme.thankYou ?? ""} onChange={(e) => set({ thankYou: e.target.value })} /></div>
          <div><label className="label" htmlFor="pf">Print footer <span className="font-normal text-ink-mute">(optional)</span></label>
            <textarea id="pf" rows={2} maxLength={300} className="input" value={theme.printFooter ?? ""} onChange={(e) => set({ printFooter: e.target.value })} placeholder="e.g. hotel address, phone, or a policy note" />
            <p className="help">Printed at the bottom of every page of the printable form.</p></div>
        </div>
      </div>
      <div className="rounded-2xl p-4 lg:sticky lg:top-6 lg:h-fit" style={{ background: theme.background || "#F4F7FC" }}>
        <FormRenderer title={title} description={description} schema={schema.slice(0, 4)} theme={theme} preview propertyName={propertyName} propertyLogo={propertyLogo} />
        {source !== "none" && !logo && <p className="mt-2 text-center text-xs text-ink-mute">No logo to show yet.</p>}
      </div>
    </div>
  );
}
