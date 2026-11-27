import { notFound } from "next/navigation";
import { rootSql } from "@/lib/db";
import { privacyOf } from "@/lib/privacy";
import { PublicShell } from "@/components/public-shell";
import { PrivacyNotice } from "@/components/privacy-notice";

export const metadata = { title: "Privacy notice" };

/** The privacy notice of the organisation that owns this form (linked from the form itself). */
export default async function FormPrivacy({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [f] = await rootSql()<{ property_id: string; tz: string }[]>`select f.property_id, p.time_zone as tz from forms f join properties p on p.id = f.property_id where f.short_code = ${code}`;
  if (!f) notFound();
  const p = await privacyOf(f.property_id);
  if (!p) notFound();
  return <PublicShell><PrivacyNotice p={p} tz={f.tz} /></PublicShell>;
}
