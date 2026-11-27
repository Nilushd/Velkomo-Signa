import { rootSql } from "./db";

/**
 * Data protection helpers. Each organisation (property) is the data controller for what its staff and visitors
 * submit; Velkomo Signa processes it on their behalf. Written to cover the common ground of Sri Lanka's PDPA (2022),
 * the GCC laws (UAE PDPL, Saudi PDPL, Qatar, Bahrain, Oman, Kuwait), India's DPDP Act (2023) and the ASEAN PDPAs:
 * a clear notice, a named contact, consent where needed, access/correction/erasure, retention limits and security.
 */
export interface PrivacyInfo {
  propertyId: string; org: string; contactName: string | null; contactEmail: string | null;
  notice: string | null; version: number; updatedAt: Date; retentionMonths: number | null; consentAllForms: boolean;
}

export async function privacyOf(propertyId: string): Promise<PrivacyInfo | null> {
  const [p] = await rootSql()<{ name: string; privacy_contact_name: string | null; privacy_contact_email: string | null; privacy_notice: string | null;
    privacy_version: number; privacy_updated_at: Date; retention_months: number | null; consent_all_forms: boolean }[]>`
    select name, privacy_contact_name, privacy_contact_email, privacy_notice, privacy_version, privacy_updated_at, retention_months, consent_all_forms
    from properties where id = ${propertyId}`;
  if (!p) return null;
  return { propertyId, org: p.name, contactName: p.privacy_contact_name, contactEmail: p.privacy_contact_email, notice: p.privacy_notice,
    version: p.privacy_version, updatedAt: p.privacy_updated_at, retentionMonths: p.retention_months, consentAllForms: p.consent_all_forms };
}

export const dataLocation = () => process.env.DATA_LOCATION || "the cloud region chosen by your organisation's Velkomo Signa provider";

export function retentionText(m: number | null) {
  if (!m) return "for as long as your organisation needs them for its records, or as the law requires";
  return m % 12 === 0 ? `for ${m / 12} year${m === 12 ? "" : "s"} after they are submitted, then deleted automatically` : `for ${m} months after they are submitted, then deleted automatically`;
}

/** The standard notice, used unless the organisation writes its own. Plain sections, rendered as headings + paragraphs. */
export function standardNotice(p: PrivacyInfo): { heading: string; body: string[] }[] {
  const contact = p.contactEmail ? `${p.contactName ? p.contactName + ", " : ""}${p.contactEmail}` : `the ${p.org} administrator`;
  return [
    { heading: "Who is responsible", body: [`${p.org} is responsible for the information you give in its forms (the “data controller”). It uses Velkomo Signa to collect and approve these forms; Velkomo Signa processes the information only on ${p.org}'s instructions.`] },
    { heading: "What we collect", body: ["The answers you type into a form, any files or photos you attach, and your signature if the form asks for one.", "Your name and e-mail address when you give them, and the decisions and comments of the people who review your request.", "Basic technical records needed to keep the service secure: sign-in times, a shortened IP address and the type of browser."] },
    { heading: "Why we use it", body: [`To handle the request you submit — route it for approval, tell you the outcome, and keep a record ${p.org} may need for its business, legal or audit obligations.`, "We do not sell your information or use it for advertising."] },
    { heading: "Who can see it", body: [`Only people at ${p.org} who are involved in your request (the approvers and reviewers chosen for the form) and its administrators. Each organisation's information is kept separate from every other organisation using Velkomo Signa.`] },
    { heading: "Where it is stored", body: [`Your information is stored in ${dataLocation()}. It is encrypted in transit, protected by access controls, and backed up. If it is stored outside your country, it is protected by contract and the same safeguards.`] },
    { heading: "How long we keep it", body: [`Requests and their attachments are kept ${retentionText(p.retentionMonths)}.`] },
    { heading: "Your rights", body: ["Depending on the law where you live, you can ask for a copy of your information, ask for it to be corrected, ask for it to be deleted, withdraw consent you have given, and object to how it is used. Staff can download their own information from Settings in the app.", `To make a request, contact ${contact}. We reply within the time the law allows (usually within one month). If you are not satisfied, you can complain to your national data protection authority.`] },
  ];
}

/** "203.94.12.0" from "203.94.12.57" — enough for a person to recognise a sign-in, not enough to identify a home. */
export function shortIp(ip: string | null | undefined) {
  if (!ip) return null;
  const v = ip.split(",")[0].trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return v.split(".").slice(0, 3).join(".") + ".0";
  if (v.includes(":")) return v.split(":").slice(0, 3).join(":") + "::";
  return null;
}

export function deviceName(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Unknown system";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export async function recordSignIn(userId: string, ip: string | null, ua: string | null, method: "password" | "two-factor") {
  await rootSql()`insert into login_events (user_id, property_id, ip_prefix, user_agent, method)
    select ${userId}, property_id, ${shortIp(ip)}, ${ua?.slice(0, 300) ?? null}, ${method} from users where id = ${userId}`;
}

/** Delete requests permanently with every attachment of every version. Returns the storage keys to remove afterwards. */
export async function purgeSubmissions(tx: import("./db").Sql, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { fileIdsIn } = await import("./validate");
  const rows = await tx<{ id: string; form_id: string; data: Record<string, unknown>; schema: import("./types").Field[] }[]>`
    select s.id, s.form_id, s.data, f.schema from submissions s join forms f on f.id = s.form_id where s.id = any(${ids}::uuid[])`;
  const keys: string[] = [];
  for (const r of rows) {
    const older = await tx<{ data: Record<string, unknown> }[]>`select data from submission_versions where submission_id = ${r.id}`;
    const fileIds = [...new Set([r.data, ...older.map((o) => o.data)].flatMap((d) => fileIdsIn(r.schema, d)))];
    await tx`delete from submissions where id = ${r.id}`;
    if (fileIds.length) {
      const gone = await tx<{ storage_key: string | null }[]>`delete from files where id in ${tx(fileIds)} and form_id = ${r.form_id} returning storage_key`;
      keys.push(...gone.map((g) => g.storage_key).filter((k): k is string => !!k));
    }
  }
  return keys;
}

/** Daily: delete requests older than each organisation's retention period (closed ones only — nothing still in progress). */
export async function applyRetention(): Promise<number> {
  const sql = rootSql();
  const due = await sql<{ id: string; property_id: string }[]>`
    select s.id, s.property_id from submissions s join properties p on p.id = s.property_id
    where p.retention_months is not null and s.status <> 'pending'
      and s.updated_at < now() - make_interval(months => p.retention_months) limit 500`;
  if (!due.length) return 0;
  const keys = await sql.begin((tx) => purgeSubmissions(tx as unknown as import("./db").Sql, due.map((d) => d.id)));
  const { removeObjects } = await import("./storage");
  await removeObjects(keys);
  const byProp = new Map<string, number>(); due.forEach((d) => byProp.set(d.property_id, (byProp.get(d.property_id) ?? 0) + 1));
  for (const [pid, n] of byProp) await sql`insert into audit_log (property_id, actor, action, detail) values (${pid}, 'Retention', 'retention_deleted', ${sql.json({ count: n })})`;
  return due.length;
}
