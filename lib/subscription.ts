import { rootSql } from "./db";

/** SQL condition text for "this hotel can use the app today": not suspended and the subscription hasn't ended. */
export type PropertyState = { active: boolean; ends: string | null; daysLeft: number | null };

export async function propertyState(propertyId: string): Promise<PropertyState | null> {
  const [p] = await rootSql()<{ active: boolean; ends: string | null; days_left: number | null }[]>`
    select active, to_char(subscription_ends, 'YYYY-MM-DD') as ends, (subscription_ends - signa_today(id))::int as days_left from properties where id = ${propertyId}`;
  return p ? { active: p.active, ends: p.ends, daysLeft: p.days_left } : null;
}

export const isOpen = (s: PropertyState | null) => !!s && s.active && (s.daysLeft === null || s.daysLeft >= 0);

export function closedMessage(s: PropertyState | null) {
  if (!s) return "This property is not available.";
  if (!s.active) return "This property's account is suspended. Please contact Velkomo support.";
  return `This property's subscription ended on ${fmtDay(s.ends)}. Please contact Velkomo support to renew.`;
}

export function fmtDay(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
