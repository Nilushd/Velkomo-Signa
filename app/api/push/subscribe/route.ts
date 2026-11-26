import { NextResponse } from "next/server";
import { getSession, asUser } from "@/lib/auth";

export async function POST(req: Request) {
  const u = await getSession();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await req.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  await asUser(u, (tx) => tx`insert into push_subscriptions (property_id, user_id, endpoint, p256dh, auth)
    values (${u.property_id}, ${u.id}, ${sub.endpoint!}, ${sub.keys!.p256dh!}, ${sub.keys!.auth!})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`);
  return NextResponse.json({ ok: true });
}
