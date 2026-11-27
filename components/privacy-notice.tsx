import { standardNotice, type PrivacyInfo } from "@/lib/privacy";
import { fmtDate } from "@/lib/format";

/** An organisation's privacy notice: its own text if it wrote one, otherwise the standard notice. */
export function PrivacyNotice({ p, tz }: { p: PrivacyInfo; tz?: string }) {
  const sections = p.notice
    ? [{ heading: "", body: p.notice.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean) }]
    : standardNotice(p);
  return (
    <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5 sm:p-8">
      <p className="text-sm font-medium text-ink-mute">{p.org}</p>
      <h1 className="mt-1 text-2xl font-bold">Privacy notice</h1>
      <p className="mt-1 text-sm text-ink-mute">Version {p.version} · updated {fmtDate(p.updatedAt, false, tz)}</p>
      <div className="mt-6 space-y-6">
        {sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="text-base font-semibold">{s.heading}</h2>}
            {s.body.map((t, j) => <p key={j} className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{t}</p>)}
          </section>))}
      </div>
      {(p.contactEmail || p.contactName) && (
        <div className="mt-8 rounded-xl bg-ink-wash p-4 text-sm">
          <p className="font-semibold">Privacy contact</p>
          <p className="mt-1 text-ink-soft">{p.contactName}{p.contactName && p.contactEmail ? " · " : ""}{p.contactEmail && <a className="text-brand-700 underline" href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a>}</p>
        </div>)}
    </article>
  );
}
