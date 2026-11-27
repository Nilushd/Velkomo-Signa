/**
 * Daily clean-up that keeps the database and object storage small (run by the Vercel cron).
 *  - uploads nobody submitted (abandoned forms, replaced files) after 1 day — from storage too
 *  - e-mail copies: the HTML body is dropped after 30 days (subject, recipient and status are kept)
 *  - read notifications after 90 days, all notifications after 180 days
 *  - expired sessions, password-reset links, used/expired e-mail action links, old rate-limit counters
 */
import { rootSql } from "./db";
import { removeObjects } from "./storage";

export async function housekeeping() {
  const sql = rootSql();
  const stale = await sql<{ id: string; storage_key: string | null }[]>`
    select id, storage_key from files where attached_at is null and not is_public and created_at < now() - interval '1 day' limit 1000`;
  await removeObjects(stale.map((f) => f.storage_key).filter((k): k is string => !!k));
  if (stale.length) await sql`delete from files where id in ${sql(stale.map((f) => f.id))}`;
  const mails = await sql`update email_log set html = '' where html <> '' and created_at < now() - interval '30 days'`;
  const notes = await sql`delete from notifications where (read_at is not null and created_at < now() - interval '90 days') or created_at < now() - interval '180 days'`;
  await sql`delete from sessions where expires_at < now()`;
  await sql`delete from password_resets where expires_at < now() - interval '1 day'`;
  await sql`delete from action_tokens where expires_at < now() - interval '30 days'`;
  await sql`delete from rate_limits where window_start < now() - interval '1 day'`;
  return { filesRemoved: stale.length, emailBodiesTrimmed: mails.count, notificationsRemoved: notes.count };
}

/** Storage used by a property (for admins in Settings). */
export async function storageUsage(propertyId: string) {
  const [f] = await rootSql()<{ n: number; bytes: number }[]>`select count(*)::int as n, coalesce(sum(size), 0)::bigint as bytes from files where property_id = ${propertyId} and state = 'ready'`;
  const [d] = await rootSql()<{ bytes: number }[]>`
    select (coalesce((select sum(pg_column_size(s.*)) from submissions s where s.property_id = ${propertyId}), 0)
          + coalesce((select sum(pg_column_size(v.*)) from submission_versions v where v.property_id = ${propertyId}), 0)
          + coalesce((select sum(pg_column_size(a.*)) from audit_log a where a.property_id = ${propertyId}), 0))::bigint as bytes`;
  return { files: Number(f.n), fileBytes: Number(f.bytes), dataBytes: Number(d.bytes) };
}
