/** Time zone choices for a hotel: every IANA zone, labelled with its current UTC offset and sorted by it. */
export function isTimeZone(tz: string) {
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; }
}

function offsetMinutes(tz: string, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

export function utcOffset(tz: string) {
  const m = offsetMinutes(tz), s = m < 0 ? "−" : "+", a = Math.abs(m);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export function timeZoneOptions() {
  const zones = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  return zones.map((z) => ({ value: z, offset: offsetMinutes(z), label: `(${utcOffset(z)}) ${z.replace(/_/g, " ")}` }))
    .sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value)).map(({ value, label }) => ({ value, label }));
}

/** Local time now in a zone, e.g. "14:05". */
export const localTime = (tz: string) => new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
