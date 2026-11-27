import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { requireUser, asUser } from "@/lib/auth";
import { loadDetail } from "@/lib/submission-view";
import { Answers, Progress, SummaryCard, History, OldVersions } from "@/components/submission-view";
import { DecisionForm } from "@/components/decision-form";
import { decideInApp } from "@/app/actions/submit";
import { Alert } from "@/components/ui";

export const metadata = { title: "Approval" };

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const r = await asUser(u, async (tx) => {
    const [a] = await tx<{ id: string; submission_id: string; level: number; step_name: string; version: number; decision: string; closed_note: string | null; approver_user_id: string; for_name: string | null }[]>`
      select a.*, (select name from users where id = a.on_behalf_of) as for_name from approvals a where a.id = ${id}`;
    if (!a || a.approver_user_id !== u.id) return null;
    return { a, d: await loadDetail(tx, a.submission_id) };
  });
  if (!r || !r.d) notFound();
  const { a, d } = r;
  const live = a.decision === "pending" && d.sub.status === "pending" && d.sub.version === a.version && d.sub.current_level === a.level;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/approvals" className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> My Approvals</Link>
        <div className="flex gap-2">
          <a href={`/api/pdf?ids=${d.sub.id}`} className="btn-secondary"><Download className="h-4 w-4" /> Download PDF</a>
          <Link href={`/print/${d.sub.id}`} className="btn-secondary"><Printer className="h-4 w-4" /> Print</Link>
        </div>
      </div>
      <SummaryCard d={d} />
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Level {a.level}: {a.step_name}</h2>
        {a.for_name && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">You&apos;re approving <b>for {a.for_name}</b>, who is out of office. Your decision is recorded as “{u.name} (for {a.for_name})”.</div>}
        {live ? <DecisionForm initial={null} action={decideInApp.bind(null, a.id)} backHref="/approvals" /> :
          <Alert kind="info">{a.decision === "closed" ? (a.closed_note ?? "Closed") : a.decision === "pending" ? "This request is no longer waiting for this decision." : `You ${a.decision} this request.`}</Alert>}
      </section>
      <section className="card p-4"><h2 className="mb-1 font-semibold">Answers</h2><Answers schema={d.form.schema} data={d.sub.data} /></section>
      <section className="card p-4"><h2 className="mb-3 font-semibold">Approval progress</h2><Progress d={d} /></section>
      <OldVersions d={d} />
      <section className="card p-4"><h2 className="mb-3 font-semibold">History</h2><History d={d} /></section>
    </div>
  );
}
