import { rootSql } from "./db";

/** A hotel's plan: how many form types may be enabled at once (null = unlimited). Submissions are unlimited. */
export async function formTypeRoom(propertyId: string, excludeFormId?: string) {
  const [r] = await rootSql()<{ lim: number | null; n: number }[]>`
    select p.form_type_limit as lim, (select count(*)::int from forms f where f.property_id = p.id and f.status = 'published' and f.id <> ${excludeFormId ?? "00000000-0000-0000-0000-000000000000"}) as n
    from properties p where p.id = ${propertyId}`;
  const limit = r?.lim ?? null, enabled = r?.n ?? 0;
  return { limit, enabled, left: limit === null ? Infinity : Math.max(0, limit - enabled) };
}

export const limitMessage = (limit: number) =>
  `Your plan allows ${limit} enabled form type${limit === 1 ? "" : "s"}. Disable a form you no longer use, or ask Velkomo to raise the limit. (Submissions are unlimited.)`;

/** The database refuses going over the limit too (race-safe); turn that error into the friendly message. */
export function limitFromError(e: unknown): number | null {
  const m = /FORM_TYPE_LIMIT:(\d+)/.exec(e instanceof Error ? e.message : String(e));
  return m ? Number(m[1]) : null;
}
