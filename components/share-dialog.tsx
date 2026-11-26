"use client";
import { useEffect, useState } from "react";
import { Copy, Check, Download, Mail, MessageCircle, Printer, Share2, X, QrCode, FileText } from "lucide-react";

/** Share a form: link, QR code (PNG/SVG), WhatsApp, e-mail, the phone's share sheet, and printable QR poster / blank form. */
export function ShareDialog({ open, onClose, url, shortCode, formId, title, status, onPublish }:
  { open: boolean; onClose: () => void; url: string; shortCode: string; formId: string; title: string; status: string; onPublish?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  useEffect(() => { setCanNative(typeof navigator !== "undefined" && !!navigator.share); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  const qr = `/api/qr/${shortCode}`;
  const text = `${title}: ${url}`;
  const live = status === "published";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share form">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">Share “{title}”</h2><p className="text-sm text-ink-mute">Anyone with access can open it from this link or QR code.</p></div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {!live && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <span className="flex-1">This form is a <b>{status}</b> — people can&apos;t fill it in until it&apos;s published.</span>
            {onPublish && <button className="btn-primary btn-sm" onClick={onPublish}>Publish now</button>}
          </div>)}
        <label className="label" htmlFor="share-url">Online link</label>
        <div className="flex gap-2">
          <input id="share-url" readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
          <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <a className="btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" style={{ color: "#16A34A" }} /> WhatsApp</a>
          <a className="btn-secondary" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Please fill in this form:\n${url}`)}`}><Mail className="h-4 w-4" /> E-mail</a>
          {canNative && <button className="btn-secondary" onClick={() => navigator.share({ title, text: `Please fill in: ${title}`, url }).catch(() => {})}><Share2 className="h-4 w-4" /> More…</button>}
          <a className="btn-secondary" href={url} target="_blank" rel="noreferrer">Open</a>
        </div>
        <div className="mt-5 flex flex-col items-center gap-4 rounded-xl bg-ink-wash p-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${qr}?format=png`} alt={`QR code for ${title}`} className="h-40 w-40 rounded-lg bg-white p-1 ring-1 ring-ink-line" />
          <div className="flex w-full flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><QrCode className="h-4 w-4" /> QR code</p>
            <a href={`${qr}?format=png&download=1`} className="btn-secondary justify-start"><Download className="h-4 w-4" /> Download PNG</a>
            <a href={`${qr}?format=svg&download=1`} className="btn-secondary justify-start"><Download className="h-4 w-4" /> Download SVG (print quality)</a>
            <a href={`/print/qr/${formId}`} target="_blank" rel="noreferrer" className="btn-secondary justify-start"><Printer className="h-4 w-4" /> Print QR poster</a>
            <a href={`/print/form/${formId}`} target="_blank" rel="noreferrer" className="btn-secondary justify-start"><FileText className="h-4 w-4" /> Printable blank form</a>
          </div>
        </div>
      </div>
    </div>
  );
}
