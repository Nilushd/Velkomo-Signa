import Link from "next/link";
import { ShieldCheck, ShieldX, CheckCircle2, XCircle, Clock } from "lucide-react";
import { rootSql } from "@/lib/db";
import { fingerprint } from "@/lib/crypto";
import { fmtDate } from "@/lib/format";
import { headerLogo, type Theme } from "@/lib/types";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { PublicShell } from "@/components/public-shell";
import { StatusBadge } from "@/components/ui";

export const metadata = { title: "Document verification", robots: { index: false } };

/**
 * Public verification (QR target). Shows only what proves authenticity — document number, form, hotel,
 * status, who approved and when, and the content fingerprint — never the answers themselves.
 */
export default async function VerifyResult({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const limited = !(await rateLimit(`verify:${await clientIp()}`, 60, 600));
  const [s] = limited ? [] : await rootSql()<{ id: string; ref_no: string; version: number; status: string; data: unknown; created_at: Date; updated_at: Date; submitter: string;
    title: string; theme: Theme; form_id: string; pname: string; plogo: string | null }[]>`
    select s.id, s.ref_no, s.version, s.status, s.data, s.created_at, s.updated_at, f.title, f.theme, f.id as form_id,
      coalesce(u.name, s.submitter_name, 'Public requester') as submitter, p.name as pname, p.logo_file_id as plogo
    from submissions s join forms f on f.id = s.form_id join properties p on p.id = s.property_id left join users u on u.id = s.submitter_id
    where s.verify_code = ${code} and p.active`;
  if (!s) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-red-200">
          <ShieldX className="mx-auto h-14 w-14 text-red-600" />
          <h1 className="mt-3 text-xl font-bold">{limited ? "Too many checks" : "Document not found"}</h1>
          <p className="mt-2 text-sm text-ink-soft">{limited ? "Please wait a few minutes and try again." : "This verification code doesn't match any document. The copy you have may not be genuine."}</p>
          <Link href="/verify" className="btn-secondary mt-5">Enter number and code</Link>
        </div>
      </PublicShell>);
  }
  const steps = await rootSql()<{ level: number; name: string }[]>`select level, name from approval_steps where form_id = ${s.form_id} order by level`;
  const decisions = await rootSql()<{ level: number; step_name: string; approver: string; decision: string; decided_at: Date }[]>`
    select a.level, a.step_name, u.name as approver, a.decision, a.decided_at from approvals a join users u on u.id = a.approver_user_id
    where a.submission_id = ${s.id} and a.version = ${s.version} and a.decision in ('approved','rejected') order by a.level`;
  const logo = headerLogo(s.theme, s.plogo) ?? s.plogo;
  const ok = s.status === "approved";
  return (
    <PublicShell>
      <div className="mx-auto max-w-lg space-y-4">
        <div className={`rounded-2xl bg-white p-6 shadow-card ring-1 ${ok ? "ring-emerald-200" : "ring-amber-200"}`}>
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-11 w-11 shrink-0 ${ok ? "text-emerald-600" : "text-amber-500"}`} />
            <div>
              <h1 className="text-lg font-bold">Genuine document</h1>
              <p className="text-sm text-ink-soft">Issued by {s.pname} through Velkomo Signa.{ok ? "" : " It is not (yet) approved — see status."}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-ink-line pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={`/api/files/${logo}`} alt="" className="h-10 w-auto max-w-[120px] object-contain" />}
            <div className="min-w-0"><p className="font-semibold">{s.title}</p>{s.theme.formCode && <p className="font-mono text-xs text-ink-mute">{s.theme.formCode}</p>}</div>
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-mute">Document No.</dt><dd className="font-mono font-semibold">{s.ref_no}{s.version > 1 ? ` · version ${s.version}` : ""}</dd>
            <dt className="text-ink-mute">Status</dt><dd><StatusBadge status={s.status} /></dd>
            <dt className="text-ink-mute">Submitted by</dt><dd>{s.submitter}</dd>
            <dt className="text-ink-mute">Submitted on</dt><dd>{fmtDate(s.created_at)}</dd>
            <dt className="text-ink-mute">Last updated</dt><dd>{fmtDate(s.updated_at)}</dd>
            <dt className="text-ink-mute">Fingerprint</dt><dd className="font-mono text-xs">{fingerprint(s.ref_no, s.version, s.data)}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-mute">The fingerprint must match the one printed at the bottom of the document. If it differs, the paper copy is out of date or has been altered.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
          <h2 className="mb-3 font-semibold">Approval record</h2>
          {steps.length === 0 ? <p className="text-sm text-ink-mute">Accepted automatically (no approval levels).</p> :
            <ol className="space-y-2.5">{steps.map((st) => {
              const d = decisions.find((x) => x.level === st.level);
              const Icon = d?.decision === "approved" ? CheckCircle2 : d?.decision === "rejected" ? XCircle : Clock;
              return (<li key={st.level} className="flex gap-3 text-sm">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${d?.decision === "approved" ? "text-emerald-600" : d?.decision === "rejected" ? "text-red-600" : "text-ink-line"}`} />
                <div><p className="font-medium">Level {st.level}: {st.name}</p>
                  <p className="text-ink-mute">{d ? `${d.decision === "approved" ? "Approved" : "Rejected"} by ${d.approver} · ${fmtDate(d.decided_at)}` : "No decision"}</p></div></li>);
            })}</ol>}
        </div>
        <p className="text-center text-xs text-ink-mute"><Link href="/verify" className="hover:text-ink">Verify another document</Link></p>
      </div>
    </PublicShell>
  );
}
