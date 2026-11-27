import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { rootSql } from "@/lib/db";
import { canReadFile, fileBytes, type StoredFile } from "@/lib/file-access";
import { fileIdsIn } from "@/lib/validate";
import type { Field } from "@/lib/types";

/** All attachments of one request as a ZIP: /api/files/zip?submission=<id>[&a=|&s=<token>]. Same access rules as single files. */
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("submission") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const [s] = await rootSql()<{ ref_no: string; data: Record<string, unknown>; schema: Field[] }[]>`
    select s.ref_no, s.data, f.schema from submissions s join forms f on f.id = s.form_id where s.id = ${id}`;
  if (!s) return new NextResponse("Not found", { status: 404 });
  const ids = fileIdsIn(s.schema, s.data);
  if (!ids.length) return new NextResponse("No attachments", { status: 404 });
  const files = await rootSql()<StoredFile[]>`select id, property_id, name, mime, data, storage_key, is_public, uploaded_by, size from files where id in ${rootSql()(ids)} and state = 'ready'`;
  const out: Record<string, Uint8Array> = {};
  for (const f of files) {
    if (!(await canReadFile(f, url.searchParams))) return new NextResponse("Not found", { status: 404 });
    let name = f.name.replace(/[/\\]/g, "_"), n = 1;
    while (out[name]) name = f.name.replace(/(\.[^.]*)?$/, (ext) => ` (${++n})${ext}`);
    const bytes = await fileBytes(f);
    if (bytes) out[name] = bytes;
  }
  return new NextResponse(zipSync(out, { level: 0 }) as unknown as BodyInit, { headers: {
    "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${s.ref_no}-attachments.zip"`, "Cache-Control": "private, no-store" } });
}
