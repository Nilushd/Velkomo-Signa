import { requireUser, asUser, accessibleHotels } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { fmtDay } from "@/lib/subscription";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const counts = await asUser(u, async (tx) => {
    const [a] = await tx<{ n: number }[]>`
      select count(*)::int as n from approvals a join submissions s on s.id = a.submission_id
      where a.approver_user_id = ${u.id} and a.decision = 'pending' and s.status = 'pending' and s.version = a.version and s.current_level = a.level`;
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from notifications where user_id = ${u.id} and read_at is null`;
    const [r] = await tx<{ n: number }[]>`select count(*)::int as n from form_access where access in ('review','approve') and (user_id = ${u.id} or group_id in (select group_id from group_members where user_id = ${u.id}))`;
    return { approvals: a.n, unread: n.n, reviewer: r.n > 0 };
  });
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        user={{ name: u.name, username: u.username, isAdmin: u.is_admin, canBuild: u.can_build_forms || u.is_admin, canStudio: u.is_admin || u.can_build_forms, reviewer: counts.reviewer }}
        property={{ name: u.property_name, code: u.property_code, logo: u.property_logo }}
        counts={{ approvals: counts.approvals, unread: counts.unread }}
        hotels={(await accessibleHotels(u)).map((h) => ({ id: h.id, code: h.code, name: h.name, home: h.home, pending: h.pending, current: h.id === u.property_id }))}
      />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          {u.is_admin && u.subscription_days_left !== null && u.subscription_days_left <= 14 && (
            <div className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
              <b>Your Velkomo Signa subscription {u.subscription_days_left === 0 ? "ends today" : `ends in ${u.subscription_days_left} day${u.subscription_days_left === 1 ? "" : "s"}`}</b> ({fmtDay(u.subscription_ends)}).
              {" "}After that, staff can&apos;t sign in and public forms close. Please contact Velkomo to renew — your data is kept.
            </div>)}
          {children}
        </div>
      </main>
    </div>
  );
}
