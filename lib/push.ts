import webpush from "web-push";
import { rootSql } from "./db";

let configured: boolean | null = null;
function ready() {
  if (configured === null) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    configured = !!(pub && priv);
    if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  }
  return configured;
}

export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!ready()) return;
  const subs = await rootSql()<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await rootSql()`delete from push_subscriptions where id = ${s.id}`;
    }
  }));
}
