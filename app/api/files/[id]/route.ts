import { NextResponse } from "next/server";
import { getSession, asUser } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

/**
 * Download a stored file. Logos are public. Attachments need: a signed-in user of the property who can
 * see a submission containing the file (RLS decides), or the e-mail action token (?a=) / status token (?s=) of that submission.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const sql = rootSql();
  const [f] = await sql<{ id: string; property_id: string; name: string; mime: string; data: Buffer; is_public: boolean; uploaded_by: string | null }[]>`
    select id, property_id, name, mime, data, is_public, uploaded_by from files where id = ${id}`;
  if (!f) return new NextResponse("Not found", { status: 404 });
  let allowed = f.is_public;
  const needle = `%${id}%`;
  if (!allowed) {
    const u = await getSession();
    if (u && u.property_id === f.property_id) {
      if (u.is_admin || f.uploaded_by === u.id) allowed = true;
      else {
        const rows = await asUser(u, (tx) => tx`select 1 from submissions where data::text like ${needle}
          union all select 1 from submission_versions v join submissions s on s.id = v.submission_id where v.data::text like ${needle} limit 1`);
        allowed = rows.length > 0;
      }
    }
  }
  if (!allowed && url.searchParams.get("a")) {
    const rows = await sql`select 1 from action_tokens t join approvals a on a.id = t.approval_id join submissions s on s.id = a.submission_id
      where t.token_hash = ${sha256(url.searchParams.get("a")!)} and t.expires_at > now() and s.data::text like ${needle}`;
    allowed = rows.length > 0;
  }
  if (!allowed && url.searchParams.get("s")) {
    const rows = await sql`select 1 from status_tokens t join submissions s on s.id = t.submission_id
      where t.token_hash = ${sha256(url.searchParams.get("s")!)} and s.data::text like ${needle}`;
    allowed = rows.length > 0;
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });
  const inline = f.mime.startsWith("image/") || f.mime === "application/pdf";
  return new NextResponse(new Uint8Array(f.data), { headers: {
    "Content-Type": f.mime,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`,
    "Cache-Control": f.is_public ? "public, max-age=86400" : "private, no-store",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  } });
}
