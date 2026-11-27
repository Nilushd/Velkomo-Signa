import { rootSql } from "@/lib/db";
import { asSystem } from "@/lib/auth";
import { resolveActionToken } from "@/lib/approvals";
import { loadDetail } from "@/lib/submission-view";
import { PublicShell, Notice } from "@/components/public-shell";
import { Answers, Progress, SummaryCard } from "@/components/submission-view";
import { DecisionForm } from "@/components/decision-form";
import { decideByToken } from "@/app/actions/submit";
import { propertyState, isOpen } from "@/lib/subscription";

export const metadata = { title: "Approve request", robots: { index: false } };

/** E-mail approval: shows the request and a confirm form. Nothing changes on GET (safe from link scanners). */
export default async function ActionPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ d?: string }> }) {
  const { token } = await params;
  const { d: pre } = await searchParams;
  const t = await resolveActionToken(token);
  if (!t) return <PublicShell><Notice title="Link not valid">This approval link doesn&apos;t work.</Notice></PublicShell>;
  const [ap] = await rootSql()<{ submission_id: string; decision: string; closed_note: string | null; name: string; step_name: string; level: number }[]>`
    select a.submission_id, a.decision, a.closed_note, u.name, a.step_name, a.level from approvals a join users u on u.id = a.approver_user_id where a.id = ${t.approval_id}`;
  const detail = await asSystem(t.property_id, (tx) => loadDetail(tx, ap.submission_id));
  if (!detail) return <PublicShell><Notice title="Request not found" /></PublicShell>;
  let blocked: string | null = null;
  if (!isOpen(await propertyState(t.property_id))) blocked = "This property's Velkomo Signa account is not active right now.";
  else if (t.used_at || ap.decision !== "pending") {
    blocked = ap.decision === "closed" ? `Already ${ap.closed_note ? ap.closed_note.charAt(0).toLowerCase() + ap.closed_note.slice(1) : "handled"}.` : `You already ${ap.decision} this request.`;
  } else if (t.expires_at < new Date()) blocked = "This link has expired. Please open the request in the app.";
  return (
    <PublicShell background={detail.form.theme.background}>
      <div className="mx-auto max-w-2xl space-y-4">
        <SummaryCard d={detail} />
        {blocked ? <Notice title="No action needed">{blocked}</Notice> : (
          <section className="card p-4">
            <h2 className="font-semibold">Your decision — Level {ap.level}: {ap.step_name}</h2>
            <p className="mb-3 text-sm text-ink-mute">Acting as {ap.name} through your personal e-mail link — no login needed.</p>
            <DecisionForm initial={pre === "reject" ? "rejected" : pre === "approve" ? "approved" : null} action={decideByToken.bind(null, token)} />
          </section>)}
        <section className="card p-4"><h2 className="mb-1 font-semibold">Answers</h2><Answers schema={detail.form.schema} data={detail.sub.data} fileQuery={`?a=${token}`} submissionId={detail.sub.id} /></section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Approval progress</h2><Progress d={detail} /></section>
      </div>
    </PublicShell>
  );
}
