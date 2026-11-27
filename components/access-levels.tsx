/** The four per-form access levels, with plain-language meaning. Shared by user pages and the form builder. */
export const ACCESS_LEVELS = [
  { v: "none", label: "No access", hint: "Can't see the form" },
  { v: "general", label: "General", hint: "Fill in and submit, see own requests" },
  { v: "review", label: "Review", hint: "Also see every submission (read-only)" },
  { v: "approve", label: "Approval", hint: "Review + can be chosen as an approver" },
] as const;
export type Level = (typeof ACCESS_LEVELS)[number]["v"];

export function AccessLegend() {
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-4">
      {ACCESS_LEVELS.map((l) => (
        <div key={l.v} className="rounded-lg bg-ink-wash px-3 py-2"><dt className="font-semibold text-ink">{l.label}</dt><dd className="text-ink-mute">{l.hint}</dd></div>))}
    </dl>
  );
}
