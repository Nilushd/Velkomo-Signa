"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, FileText, FileImage, File as FileIcon, X } from "lucide-react";
import type { FileRef } from "@/lib/types";
import { PdfPreview } from "./pdf-preview";

const IMG = /\.(png|jpe?g|webp|gif)$/i;
const kindOf = (name: string) => (IMG.test(name) ? "image" : /\.pdf$/i.test(name) ? "pdf" : /\.(xlsx?|csv)$/i.test(name) ? "sheet" : /\.(docx?|txt)$/i.test(name) ? "doc" : "other");
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const sep = (q: string) => (q ? "&" : "?");

/** Attachment cards with thumbnails, a quick-view window (images, PDFs) and download buttons. `query` carries an e-mail/status-link token when there's no login. */
export function AttachmentList({ files, query = "" }: { files: FileRef[]; query?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const src = (f: FileRef) => `/api/files/${f.fileId}${query}`;
  const dl = (f: FileRef) => `/api/files/${f.fileId}${query}${sep(query)}download=1`;
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + files.length) % files.length)), [files.length]);
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, close, step]);
  const cur = open !== null ? files[open] : null;
  const curKind = cur ? kindOf(cur.name) : null;

  return (
    <>
      <ul className="grid gap-2">
        {files.map((f, i) => {
          const k = kindOf(f.name);
          const Icon = k === "image" ? FileImage : k === "pdf" ? FileText : k === "sheet" ? FileSpreadsheet : k === "doc" ? FileText : FileIcon;
          return (
            <li key={f.fileId} className="flex items-center gap-3 rounded-lg border border-ink-line bg-white p-2">
              <button type="button" onClick={() => setOpen(i)} className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-ink-wash ring-1 ring-ink-line" aria-label={`Quick view ${f.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {k === "image" ? <img src={src(f)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Icon className={k === "pdf" ? "h-6 w-6 text-red-600" : k === "sheet" ? "h-6 w-6 text-emerald-700" : "h-6 w-6 text-brand-600"} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                <p className="text-xs text-ink-mute">{k === "image" ? "Image" : k === "pdf" ? "PDF" : k === "sheet" ? "Spreadsheet" : k === "doc" ? "Document" : "File"} · {size(f.size)}</p>
              </div>
              <button type="button" onClick={() => setOpen(i)} className="btn-secondary btn-sm shrink-0" aria-label={`View ${f.name}`}><Eye className="h-4 w-4" /> View</button>
              <a href={dl(f)} className="btn-ghost btn-sm shrink-0" aria-label={`Download ${f.name}`} title="Download"><Download className="h-4 w-4" /></a>
            </li>);
        })}
      </ul>

      {cur && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80" role="dialog" aria-modal="true" aria-label={`Preview of ${cur.name}`} onClick={close}>
          <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{cur.name} <span className="text-white/60">· {size(cur.size)}{files.length > 1 ? ` · ${open! + 1} of ${files.length}` : ""}</span></p>
            <a href={dl(cur)} className="btn bg-white text-ink hover:bg-ink-wash"><Download className="h-4 w-4" /> Download</a>
            <a href={src(cur)} target="_blank" rel="noreferrer" className="btn hidden text-white ring-1 ring-white/30 hover:bg-white/10 sm:inline-flex">Open in new tab</a>
            <button className="btn px-2 text-white hover:bg-white/10" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {files.length > 1 && <button className="absolute left-3 z-10 rounded-full bg-white/90 p-2 text-ink shadow hover:bg-white" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>}
            {curKind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src(cur)} alt={cur.name} className="max-h-full max-w-full rounded-md bg-white object-contain shadow-2xl" />)}
            {curKind === "pdf" && <PdfPreview key={cur.fileId} url={src(cur)} />}
            {curKind !== "image" && curKind !== "pdf" && (
              <div className="rounded-xl bg-white p-8 text-center shadow-2xl">
                <FileIcon className="mx-auto h-12 w-12 text-ink-mute" />
                <p className="mt-3 font-semibold">{cur.name}</p>
                <p className="mt-1 text-sm text-ink-mute">This kind of file can&apos;t be previewed in the browser.</p>
                <a href={dl(cur)} className="btn-primary mt-4"><Download className="h-4 w-4" /> Download to open it</a>
              </div>)}
            {files.length > 1 && <button className="absolute right-3 z-10 rounded-full bg-white/90 p-2 text-ink shadow hover:bg-white" onClick={() => step(1)} aria-label="Next"><ChevronRight className="h-5 w-5" /></button>}
          </div>
        </div>)}
    </>
  );
}
