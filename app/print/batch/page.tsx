import { redirect } from "next/navigation";
import { getSession, asUser } from "@/lib/auth";
import { fingerprint } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { loadDetail, type Detail } from "@/lib/submission-view";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";

export const metadata = { title: "Print submissions", robots: { index: false } };

/** Several submissions in one print view — each on its own pages. */
export default async function PrintBatch({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const u = await getSession();
  const { ids: raw = "" } = await searchParams;
  if (!u) redirect(`/login?next=${encodeURIComponent(`/print/batch?ids=${raw}`)}`);
  const ids = [...new Set(raw.split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)))].slice(0, 100);
  const details = (await asUser(u, async (tx) => Promise.all(ids.map((id) => loadDetail(tx, id))))).filter((d): d is Detail => !!d);
  return (
    <div className="min-h-screen bg-ink-wash py-6 print:bg-white print:py-0">
      <PrintToolbar backHref="/submissions" pdfHref={`/api/pdf?ids=${details.map((d) => d.sub.id).join(",")}`} label={`${details.length} form${details.length === 1 ? "" : "s"}`} />
      {details.map((d) => (
        <PrintDocument key={d.sub.id} d={d} toolbar={false} propertyName={u.property_name} propertyLogo={u.property_logo} backHref="/submissions"
          verifyUrl={`${appUrl()}/v/${d.sub.verify_code}`} verifyPage={`${appUrl()}/verify`} fingerprint={fingerprint(d.sub.ref_no, d.sub.version, d.sub.data)} printedBy={u.name} />
      ))}
    </div>
  );
}
