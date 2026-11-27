import { getSession, asUser } from "./auth";
import { rootSql } from "./db";
import { sha256 } from "./crypto";

export interface StoredFile { id: string; property_id: string; name: string; mime: string; data: Buffer | null; storage_key: string | null; is_public: boolean; uploaded_by: string | null; size: number }

/**
 * May this request read the file? Logos are public. Attachments: a signed-in user of the property who can see a
 * submission containing the file (Row Level Security decides), or the e-mail approval link (?a=) / status link (?s=)
 * of that submission.
 */
export async function canReadFile(f: Pick<StoredFile, "id" | "property_id" | "is_public" | "uploaded_by">, params: URLSearchParams) {
  if (f.is_public) return true;
  const needle = `%${f.id}%`;
  const u = await getSession();
  if (u && u.property_id === f.property_id) {
    if (u.is_admin || f.uploaded_by === u.id) return true;
    const rows = await asUser(u, (tx) => tx`select 1 from submissions where data::text like ${needle}
      union all select 1 from submission_versions v join submissions s on s.id = v.submission_id where v.data::text like ${needle} limit 1`);
    if (rows.length) return true;
  }
  const sql = rootSql();
  const a = params.get("a"), s = params.get("s");
  if (a) {
    const rows = await sql`select 1 from action_tokens t join approvals ap on ap.id = t.approval_id join submissions sub on sub.id = ap.submission_id
      where t.token_hash = ${sha256(a)} and t.expires_at > now() and sub.data::text like ${needle}`;
    if (rows.length) return true;
  }
  if (s) {
    const rows = await sql`select 1 from status_tokens t join submissions sub on sub.id = t.submission_id
      where t.token_hash = ${sha256(s)} and sub.data::text like ${needle}`;
    if (rows.length) return true;
  }
  return false;
}

/** Content-Disposition that keeps non-ASCII file names intact. */
export function disposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The file's bytes, wherever they are stored (for the ZIP, PDFs, and the upload check). */
export async function fileBytes(f: { data: Buffer | null; storage_key: string | null }): Promise<Uint8Array | null> {
  if (f.data) return new Uint8Array(f.data);
  if (f.storage_key) { const { getObject } = await import("./storage"); return getObject(f.storage_key); }
  return null;
}
