import clsx from "clsx";
import type { SubmissionStatus } from "@/lib/types";

export function Logo({ white = false, className = "h-8" }: { white?: boolean; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={white ? "/brand/velkomo-signa-logo-horizontal-white.svg" : "/brand/velkomo-signa-logo-horizontal.svg"} alt="Velkomo Signa" className={clsx("w-auto", className)} />;
}

const STATUS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-1 ring-red-200",
  withdrawn: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
  closed: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
  draft: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
  published: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
};
export function StatusBadge({ status }: { status: SubmissionStatus | string }) {
  return <span className={clsx("badge capitalize", STATUS[status] ?? STATUS.draft)}>{status === "withdrawn" ? "cancelled" : status === "closed" ? "disabled" : status}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/velkomo-signa-icon.svg" alt="" className="mb-3 h-10 w-10 opacity-80" />
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-mute">{children}</div>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warn"; children: React.ReactNode }) {
  const c = { info: "bg-brand-50 text-brand-800 ring-brand-200", error: "bg-red-50 text-red-800 ring-red-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200", warn: "bg-amber-50 text-amber-900 ring-amber-200" }[kind];
  return <div className={clsx("rounded-lg px-3 py-2 text-sm ring-1", c)}>{children}</div>;
}
