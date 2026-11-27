import clsx from "clsx";

export type SubState = "suspended" | "expired" | "expiring" | "active" | "open" | "platform";

export function subState(p: { active: boolean; days_left: number | null; is_platform?: boolean }): SubState {
  if (p.is_platform) return "platform";
  if (!p.active) return "suspended";
  if (p.days_left === null) return "open";
  if (p.days_left < 0) return "expired";
  if (p.days_left <= 30) return "expiring";
  return "active";
}

export function SubBadge({ state, daysLeft }: { state: SubState; daysLeft: number | null }) {
  const [label, cls] = {
    platform: ["Platform", "bg-ink-wash text-ink-soft ring-ink-line"],
    suspended: ["Suspended", "bg-slate-100 text-slate-700 ring-slate-300"],
    expired: ["Expired", "bg-red-50 text-red-700 ring-red-200"],
    expiring: [daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, "bg-amber-50 text-amber-800 ring-amber-200"],
    active: ["Active", "bg-emerald-50 text-emerald-800 ring-emerald-200"],
    open: ["Active · no end date", "bg-emerald-50 text-emerald-800 ring-emerald-200"],
  }[state];
  return <span className={clsx("badge whitespace-nowrap ring-1", cls)}>{label}</span>;
}
