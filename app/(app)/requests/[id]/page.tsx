import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { requireUser, asUser } from "@/lib/auth";
import { loadDetail } from "@/lib/submission-view";
import { Answers, Progress, SummaryCard, History, OldVersions } from "@/components/submission-view";
import { RequesterActions } from "@/components/requester-actions";

export const metadata = { title: "Request" };

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const d = await asUser(u, (tx) => loadDetail(tx, id));
  if (!d) notFound();
  const mine = d.sub.submitter_id === u.id;
  const lastReject = d.approvals.filter((a) => a.version === d.sub.version && a.decision === "rejected").pop();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href={mine ? "/requests" : "/submissions"} className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="flex gap-2">
          <a href={`/api/pdf?ids=${d.sub.id}`} className="btn-secondary"><Download className="h-4 w-4" /> Download PDF</a>
          <Link href={`/print/${d.sub.id}`} className="btn-secondary"><Printer className="h-4 w-4" /> Print</Link>
        </div>
      </div>
      <SummaryCard d={d} />
      {mine && d.sub.status === "rejected" && <RequesterActions submissionId={d.sub.id} uploadCode={d.form.short_code} title={d.form.title} schema={d.form.schema} theme={d.form.theme} data={d.sub.data} comment={lastReject?.comment} />}
      <section className="card p-4"><h2 className="mb-3 font-semibold">Approval progress</h2><Progress d={d} /></section>
      <section className="card p-4"><h2 className="mb-1 font-semibold">Answers</h2><Answers schema={d.form.schema} data={d.sub.data} /></section>
      <OldVersions d={d} />
      <section className="card p-4"><h2 className="mb-3 font-semibold">History</h2><History d={d} /></section>
    </div>
  );
}
