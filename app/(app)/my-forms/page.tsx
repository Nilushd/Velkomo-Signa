import Link from "next/link";
import { requireUser, asUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";

export const metadata = { title: "My Forms" };

export default async function MyForms() {
  const u = await requireUser();
  const forms = await asUser(u, (tx) => tx<{ id: string; title: string; description: string; short_code: string; visibility: string; access: string | null }[]>`
    select f.id, f.title, f.description, f.short_code, f.visibility,
      (select case when bool_or(access='review') then 'review' when bool_or(access='general') then 'general' end from form_access fa
        where fa.form_id = f.id and (fa.user_id = ${u.id} or fa.group_id in (select group_id from group_members where user_id = ${u.id}))) as access
    from forms f
    where f.status = 'published' and (f.closes_at is null or f.closes_at > now())
    order by f.title`);
  const visible = forms.filter((f) => f.visibility !== "assigned" || f.access || u.is_admin);
  return (
    <>
      <PageHeader title="My Forms" subtitle="Forms you can fill in and submit." />
      {visible.length === 0 ? <Empty title="No forms yet">Your admin hasn&apos;t given you access to any forms.</Empty> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((f) => (
            <Link key={f.id} href={`/f/${f.short_code}`} className="card group flex flex-col p-4 transition hover:border-brand-300">
              <p className="font-semibold group-hover:text-brand-700">{f.title}</p>
              {f.description && <p className="mt-1 line-clamp-2 text-sm text-ink-mute">{f.description}</p>}
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-ink-mute">
                {f.access === "review" && <span className="badge bg-brand-50 text-brand-700">Reviewer</span>}
                {f.visibility === "public" && <span className="badge bg-cyan-50 text-cyan-800">Public</span>}
                <span className="ml-auto font-medium text-brand-700">Open →</span>
              </div>
            </Link>
          ))}
        </div>}
    </>
  );
}
