import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { rootSql, tenant } from "@/lib/db";
import { formAccess, canSubmit, canReview, canEditForm } from "@/lib/access";
import { appUrl } from "@/lib/env";
import type { FormRow } from "@/lib/types";
import { PrintBlank } from "@/components/print-document";

export const metadata = { title: "Print blank form", robots: { index: false } };

/** Blank paper version of a form: anyone who may open the form (drafts: only its editors). */
export default async function PrintBlankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [form] = await rootSql()<FormRow[]>`select * from forms where id = ${id}`;
  if (!form) notFound();
  const s = await getSession();
  const user = s && s.property_id === form.property_id ? s : null;
  const { access, steps } = await tenant({ propertyId: form.property_id, userId: null }, async (tx) => ({
    access: await formAccess(tx, user, form),
    steps: await tx<{ level: number; name: string }[]>`select level, name from approval_steps where form_id = ${form.id} order by level`,
  }));
  const ok = form.status === "draft" ? canEditForm(access) : canSubmit(form, user, access) || canReview(access);
  if (!ok) notFound();
  const [p] = await rootSql()<{ name: string; logo_file_id: string | null }[]>`select name, logo_file_id from properties where id = ${form.property_id}`;
  return <PrintBlank form={form} propertyName={p.name} propertyLogo={p.logo_file_id} fillUrl={`${appUrl()}/f/${form.short_code}`} steps={steps}
    backHref={user && canEditForm(access) ? `/forms/${form.id}/edit` : `/f/${form.short_code}`} />;
}
