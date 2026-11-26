import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser, asUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { PushToggle } from "@/components/push-toggle";

export const metadata = { title: "Notifications" };

async function markAll() {
  "use server";
  const u = await requireUser();
  await asUser(u, (tx) => tx`update notifications set read_at = now() where user_id = ${u.id} and read_at is null`);
  revalidatePath("/", "layout");
}

export default async function Notifications() {
  const u = await requireUser();
  const rows = await asUser(u, (tx) => tx<{ id: string; title: string; body: string; url: string | null; read_at: Date | null; created_at: Date }[]>`
    select * from notifications where user_id = ${u.id} order by created_at desc limit 100`);
  return (
    <>
      <PageHeader title="Notifications" actions={<><PushToggle /><form action={markAll}><button className="btn-secondary">Mark all read</button></form></>} />
      {rows.length === 0 ? <Empty title="No notifications" /> :
        <ul className="card divide-y divide-ink-line">{rows.map((n) => (
          <li key={n.id}><Link href={n.url ?? "#"} className="flex gap-3 px-4 py-3 hover:bg-ink-wash">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-600"}`} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{n.title}</p>{n.body && <p className="text-sm text-ink-mute">{n.body}</p>}</div>
            <span className="shrink-0 text-xs text-ink-mute">{fmtDate(n.created_at)}</span></Link></li>))}</ul>}
    </>
  );
}
