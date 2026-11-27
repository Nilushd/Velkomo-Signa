import Link from "next/link";
import { getSession } from "@/lib/auth";
import { privacyOf, dataLocation } from "@/lib/privacy";
import { PublicShell } from "@/components/public-shell";
import { PrivacyNotice } from "@/components/privacy-notice";

export const metadata = { title: "Privacy" };

/** Signed in: your organisation's notice. Otherwise: how the Velkomo Signa service itself handles data. */
export default async function Privacy() {
  const u = await getSession();
  if (u) { const p = await privacyOf(u.property_id); if (p) return <PublicShell><PrivacyNotice p={p} tz={u.time_zone} /><p className="mt-4 text-center text-sm"><Link href="/settings#your-data" className="text-brand-700 underline">Your data and sign-in history</Link></p></PublicShell>; }
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <PublicShell>
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5 sm:p-8">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-ink-soft">
          <p>Velkomo Signa is used by organisations to run their forms and approvals online. Each organisation decides what its forms ask for and who sees the answers — it is the <b>data controller</b>, and Velkomo Signa processes the information only on its instructions.</p>
          <p>Every form has a link to the privacy notice of the organisation that owns it, with its own contact for questions and requests.</p>
          <p>Information is stored in {dataLocation()}, encrypted in transit, kept separate for each organisation, and protected by access controls, two-factor sign-in and audit history. We only use essential cookies — to keep you signed in and remember your organisation code on this device — and no advertising or tracking cookies.</p>
          <p>To ask for a copy of your information, a correction or deletion, contact the organisation you dealt with{contact ? <>, or write to <a className="text-brand-700 underline" href={`mailto:${contact}`}>{contact}</a></> : ""}.</p>
        </div>
      </article>
    </PublicShell>
  );
}
