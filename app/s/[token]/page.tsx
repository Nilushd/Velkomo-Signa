import Link from "next/link";
import { rootSql } from "@/lib/db";
import { asSystem } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { loadDetail, canChange } from "@/lib/submission-view";
import { RequestManage } from "@/components/request-manage";
import { PublicShell, Notice } from "@/components/public-shell";
import { Answers, Progress, SummaryCard, History } from "@/components/submission-view";
import { RequesterActions } from "@/components/requester-actions";

export const metadata = { title: "Request status", robots: { index: false } };

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t] = await rootSql()<{ submission_id: string; property_id: string }[]>`select submission_id, property_id from status_tokens where token_hash = ${sha256(token)}`;
  if (!t) return <PublicShell><Notice title="Link not valid">This status link doesn&apos;t work. Please use the latest e-mail we sent you.</Notice></PublicShell>;
  const d = await asSystem(t.property_id, (tx) => loadDetail(tx, t.submission_id));
  if (!d) return <PublicShell><Notice title="Request not found" /></PublicShell>;
  const lastReject = d.approvals.filter((a) => a.version === d.sub.version && a.decision === "rejected").pop();
  const canEdit = d.sub.status === "rejected" && !d.sub.submitter_id;
  return (
    <PublicShell background={d.form.theme.background}>
      <div className="mx-auto max-w-2xl space-y-4">
        <SummaryCard d={d} />
        <div className="flex justify-end gap-2"><a href={`/api/pdf?ids=${d.sub.id}&s=${encodeURIComponent(token)}`} className="btn-secondary">Download PDF</a><Link href={`/print/${d.sub.id}?s=${token}`} className="btn-secondary">Print</Link></div>
        {canEdit && <RequesterActions submissionId={d.sub.id} token={token} uploadCode={d.form.short_code} title={d.form.title} schema={d.form.schema} theme={d.form.theme} data={d.sub.data} comment={lastReject?.comment} />}
        {d.sub.status === "rejected" && d.sub.submitter_id && <Notice title="Rejected">Sign in to the app to edit and resubmit this request.</Notice>}
        <section className="card p-4"><h2 className="mb-3 font-semibold">Approval progress</h2><Progress d={d} /></section>
        <section className="card p-4"><h2 className="mb-1 font-semibold">Your answers</h2><Answers schema={d.form.schema} data={d.sub.data} fileQuery={`?s=${token}`} submissionId={d.sub.id} /></section>
        {!d.sub.submitter_id && canChange(d) && <RequestManage submissionId={d.sub.id} refNo={d.sub.ref_no} token={token} rejected={d.sub.status === "rejected"} asAdmin={false} afterDelete={`/f/${d.form.short_code}`} />}
        <section className="card p-4"><h2 className="mb-3 font-semibold">History</h2><History d={d} /></section>
      </div>
    </PublicShell>
  );
}
