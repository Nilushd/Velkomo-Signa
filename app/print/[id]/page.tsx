import { notFound, redirect } from "next/navigation";
import { getSession, asUser, asSystem } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { sha256, fingerprint } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { loadDetail, type Detail } from "@/lib/submission-view";
import { PrintDocument } from "@/components/print-document";

export const metadata = { title: "Print", robots: { index: false } };

/** Printable copy of a submission. Signed-in users (RLS decides) or a public requester's status link (?s=). */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await params;
  const { s } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let d: Detail | null = null;
  let printedBy = "requester";
  let back = `/requests/${id}`;
  let propertyId: string;
  if (s) {
    const [t] = await rootSql()<{ submission_id: string; property_id: string }[]>`select submission_id, property_id from status_tokens where token_hash = ${sha256(s)}`;
    if (!t || t.submission_id !== id) notFound();
    d = await asSystem(t.property_id, (tx) => loadDetail(tx, id));
    propertyId = t.property_id;
    back = `/s/${s}`;
  } else {
    const u = await getSession();
    if (!u) redirect(`/login?next=/print/${id}`);
    d = await asUser(u, (tx) => loadDetail(tx, id));
    printedBy = u.name;
    propertyId = u.property_id;
  }
  if (!d) notFound();
  const [p] = await rootSql()<{ name: string; logo_file_id: string | null }[]>`select name, logo_file_id from properties where id = ${propertyId}`;
  return (
    <PrintDocument d={d} propertyName={p.name} propertyLogo={p.logo_file_id}
      verifyUrl={`${appUrl()}/v/${d.sub.verify_code}`} verifyPage={`${appUrl()}/verify`}
      fingerprint={fingerprint(d.sub.ref_no, d.sub.version, d.sub.data)} printedBy={printedBy} backHref={back} />
  );
}
