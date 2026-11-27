"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Printer, Download } from "lucide-react";
export function PrintToolbar({ backHref, pdfHref, label }: { backHref: string; pdfHref?: string; label?: string }) {
  useEffect(() => { if (new URLSearchParams(location.search).get("auto") === "1") setTimeout(() => window.print(), 400); }, []);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2">
      <Link href={backHref} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-2">
        {label && <span className="hidden text-sm text-ink-mute sm:inline">{label}</span>}
        {pdfHref && <a href={pdfHref} className="btn-secondary"><Download className="h-4 w-4" /> Download PDF</a>}
        <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" /> Print</button>
      </div>
    </div>
  );
}
