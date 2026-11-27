"use client";
import { useEffect, useRef, useState } from "react";

/** Renders a PDF's pages to canvases with pdf.js, so the quick view works on every browser and phone. */
export function PdfPreview({ url, maxPages = 30 }: { url: string; maxPages?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ loading: boolean; error?: string; pages?: number; total?: number }>({ loading: true });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Couldn't load the file.");
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()), isEvalSupported: false }).promise;
        const el = box.current;
        if (!el || cancelled) return;
        el.innerHTML = "";
        const n = Math.min(doc.numPages, maxPages);
        const width = Math.min(el.clientWidth || 800, 1000);
        for (let i = 1; i <= n && !cancelled; i++) {
          const page = await doc.getPage(i);
          const v1 = page.getViewport({ scale: 1 });
          const ratio = window.devicePixelRatio || 1;
          const vp = page.getViewport({ scale: (width / v1.width) * ratio });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = `${width}px`; c.className = "mx-auto mb-3 block rounded bg-white shadow-xl";
          el.appendChild(c);
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c } as never).promise;
        }
        if (!cancelled) setState({ loading: false, pages: n, total: doc.numPages });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e instanceof Error ? e.message : "Couldn't show this PDF." });
      }
    })();
    return () => { cancelled = true; };
  }, [url, maxPages]);
  return (
    <div className="h-full w-full max-w-5xl overflow-auto">
      {state.loading && <p className="py-10 text-center text-sm text-white/80">Loading PDF…</p>}
      {state.error && <p className="py-10 text-center text-sm text-white">{state.error} Use Download instead.</p>}
      <div ref={box} />
      {state.total && state.pages && state.total > state.pages && <p className="pb-4 text-center text-xs text-white/70">Showing the first {state.pages} of {state.total} pages — download for the rest.</p>}
    </div>
  );
}
