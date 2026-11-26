import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { rootSql, tenant } from "@/lib/db";
import { formAccess, canSubmit, canReview, canEditForm } from "@/lib/access";
import { appUrl } from "@/lib/env";
import { headerLogo, type FormRow } from "@/lib/types";
import { PrintToolbar } from "@/components/print-toolbar";

export const metadata = { title: "QR poster", robots: { index: false } };

/** A4 poster: hotel logo, form name, a big QR code and the link — to put up at a desk or in a staff room. */
export default async function QrPoster({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [form] = await rootSql()<FormRow[]>`select * from forms where id = ${id}`;
  if (!form) notFound();
  const s = await getSession();
  const user = s && s.property_id === form.property_id ? s : null;
  const access = await tenant({ propertyId: form.property_id, userId: null }, (tx) => formAccess(tx, user, form));
  if (!(form.status === "draft" ? canEditForm(access) : canSubmit(form, user, access) || canReview(access))) notFound();
  const [p] = await rootSql()<{ name: string; logo_file_id: string | null }[]>`select name, logo_file_id from properties where id = ${form.property_id}`;
  const url = `${appUrl()}/f/${form.short_code}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "H", color: { dark: "#0F172A", light: "#FFFFFF" } });
  const logo = headerLogo(form.theme, p.logo_file_id) ?? p.logo_file_id;
  const color = form.theme.primary || "#2563EB";
  return (
    <div className="min-h-screen bg-ink-wash py-6 print:bg-white print:py-0">
      <PrintToolbar backHref={user && canEditForm(access) ? `/forms/${form.id}/edit` : `/f/${form.short_code}`} />
      <article className="print-sheet mx-auto flex min-h-[270mm] max-w-[210mm] flex-col items-center justify-between bg-white p-[16mm] text-center shadow-card">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={`/api/files/${logo}`} alt="" className="h-20 w-auto max-w-[260px] object-contain" />}
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-soft">{p.name}</p>
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-[34px] font-bold leading-tight text-ink">{form.title}</h1>
          {form.theme.formCode && <p className="mt-1 font-mono text-sm text-ink-mute">{form.theme.formCode}</p>}
          <div className="mt-8 rounded-3xl border-[6px] p-4" style={{ borderColor: color }}>
            <div className="h-[120mm] w-[120mm] max-w-[70vw] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" />
          </div>
          <p className="mt-6 text-2xl font-semibold" style={{ color }}>Scan to fill in online</p>
          <p className="mt-2 font-mono text-sm text-ink-soft">{url}</p>
        </div>
        <p className="text-xs text-ink-mute">Velkomo Signa</p>
      </article>
    </div>
  );
}
