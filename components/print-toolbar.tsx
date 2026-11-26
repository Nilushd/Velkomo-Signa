"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";
export function PrintToolbar({ backHref }: { backHref: string }) {
  useEffect(() => { if (new URLSearchParams(location.search).get("auto") === "1") setTimeout(() => window.print(), 400); }, []);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2">
      <Link href={backHref} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-ink-mute sm:inline">Tip: choose “Save as PDF” in the print dialog for a PDF copy.</span>
        <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" /> Print / Save PDF</button>
      </div>
    </div>
  );
}
