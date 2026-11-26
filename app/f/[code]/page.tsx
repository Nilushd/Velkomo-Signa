import Link from "next/link";
import { redirect } from "next/navigation";
import { rootSql, tenant } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formAccess, canSubmit } from "@/lib/access";
import type { FormRow } from "@/lib/types";
import { PublicShell, Notice } from "@/components/public-shell";
import { FillForm } from "./fill-form";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [f] = await rootSql()<{ title: string }[]>`select title from forms where short_code = ${code} and status <> 'draft'`;
  return { title: f?.title ?? "Form" };
}

export default async function FormPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [form] = await rootSql()<FormRow[]>`select * from forms where short_code = ${code}`;
  const s = await getSession();
  if (!form || form.status === "draft") {
    // owners/admins may preview drafts
    if (form && s && s.property_id === form.property_id && (s.is_admin || s.id === form.owner_id)) return redirect(`/forms/${form.id}/edit`);
    return <PublicShell><Notice title="Form not available">This form doesn&apos;t exist or hasn&apos;t been published yet.</Notice></PublicShell>;
  }
  const bg = form.theme.background;
  if (form.visibility !== "public") {
    if (!s) redirect(`/login?next=/f/${code}`);
    if (s.must_change_password) redirect("/change-password");
  }
  const user = s && s.property_id === form.property_id ? s : null;
  const access = await tenant({ propertyId: form.property_id, userId: null }, (tx) => formAccess(tx, user, form));
  if (!canSubmit(form, user, access)) {
    return <PublicShell background={bg}><Notice title="You don't have access to this form" action={<Link href="/" className="btn-secondary">Go to the app</Link>}>Ask your admin if you think you should.</Notice></PublicShell>;
  }
  const [{ n }] = await rootSql()<{ n: number }[]>`select count(*)::int as n from submissions where form_id = ${form.id}`;
  if (form.status === "closed" || (form.closes_at && form.closes_at < new Date()) || (form.max_submissions && n >= form.max_submissions)) {
    return <PublicShell background={bg}><Notice title={form.title}>This form is closed and no longer accepts submissions.</Notice></PublicShell>;
  }
  const [prop] = await rootSql()<{ name: string; logo_file_id: string | null }[]>`select name, logo_file_id from properties where id = ${form.property_id}`;
  return (
    <PublicShell background={bg}>
      <FillForm code={code} propertyName={prop.name} propertyLogo={prop.logo_file_id} title={form.title} description={form.description} schema={form.schema} theme={form.theme}
        signedInAs={user ? user.name : null} captchaSiteKey={!user ? process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY ?? null : null}
        initial={user ? prefill(form, user) : undefined} />
    </PublicShell>
  );
}

function prefill(form: FormRow, u: { name: string; email: string | null }) {
  const d: Record<string, unknown> = {};
  const nameF = form.schema.find((f) => f.type === "text" && /name/i.test(f.label));
  const emailF = form.schema.find((f) => f.type === "email");
  if (nameF) d[nameF.id] = u.name;
  if (emailF && u.email) d[emailF.id] = u.email;
  return d;
}
