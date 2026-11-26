"use client";
import { useState } from "react";
import type { Field, Theme } from "@/lib/types";
import { FormRenderer } from "../form-renderer";

const SWATCHES = ["#2563EB", "#0B1F4D", "#0891B2", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#475569"];

export function ThemeTab({ theme, setTheme, title, description, schema }: { theme: Theme; setTheme: (t: Theme) => void; title: string; description: string; schema: Field[] }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Theme>) => setTheme({ ...theme, ...p });
  async function upload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("Choose an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setErr("Logos can be at most 2 MB."); return; }
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("purpose", "logo");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    setUploading(false);
    if (!r.ok) setErr(j.error ?? "Upload failed"); else set({ logoFileId: j.fileId });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="card h-fit space-y-5 p-4">
        <div>
          <p className="label">Logo</p>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {theme.logoFileId ? <img src={`/api/files/${theme.logoFileId}`} alt="" className="h-12 max-w-[140px] rounded border border-ink-line object-contain p-1" /> : <div className="grid h-12 w-20 place-items-center rounded border border-dashed border-ink-line text-xs text-ink-mute">None</div>}
            <label className="btn-secondary btn-sm cursor-pointer">{uploading ? "Uploading…" : "Upload"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            {theme.logoFileId && <button className="btn-ghost btn-sm" onClick={() => set({ logoFileId: null })}>Remove</button>}
          </div>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
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
        <div>
          <label className="label" htmlFor="ty">Thank-you message</label>
          <textarea id="ty" rows={3} className="input" value={theme.thankYou ?? ""} onChange={(e) => set({ thankYou: e.target.value })} />
        </div>
      </div>
      <div className="rounded-2xl p-4" style={{ background: theme.background || "#F4F7FC" }}>
        <FormRenderer title={title} description={description} schema={schema.slice(0, 4)} theme={theme} preview />
      </div>
    </div>
  );
}
