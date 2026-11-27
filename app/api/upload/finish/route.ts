import { NextResponse } from "next/server";
import { rootSql } from "@/lib/db";
import { checkFile, MAX_UPLOAD } from "@/lib/files";
import { getObject, removeObjects } from "@/lib/storage";

/** Step 3 of a direct upload: read the stored object back, check its real size and content, then mark it ready. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { fileId?: string } | null;
  const id = String(body?.fileId ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const sql = rootSql();
  const [f] = await sql<{ id: string; name: string; mime: string; storage_key: string; is_public: boolean; form_id: string | null }[]>`
    select id, name, mime, storage_key, is_public, form_id from files where id = ${id} and state = 'uploading' and created_at > now() - interval '2 hours'`;
  if (!f) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const bytes = await getObject(f.storage_key);
  const fail = async (error: string, status: number) => {
    await removeObjects([f.storage_key]); await sql`delete from files where id = ${f.id}`;
    return NextResponse.json({ error }, { status });
  };
  if (!bytes) return fail("The upload didn't arrive. Please try again.", 400);
  if (bytes.length > MAX_UPLOAD) return fail("Files can be at most 10 MB.", 413);
  const c = checkFile(f.name, f.mime, bytes, { imagesOnly: f.is_public && !f.form_id });
  if ("error" in c) return fail(c.error, 415);
  await sql`update files set state = 'ready', size = ${bytes.length}, attached_at = ${f.is_public ? new Date() : null} where id = ${f.id}`;
  return NextResponse.json({ fileId: f.id, name: f.name, size: bytes.length });
}
