import { NextResponse } from "next/server";
import { rootSql } from "@/lib/db";
import { canReadFile, disposition, type StoredFile } from "@/lib/file-access";
import { signedDownload } from "@/lib/storage";

/** One stored file. Images and PDFs open in the browser (quick view); ?download=1 always downloads. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const [f] = await rootSql()<StoredFile[]>`select id, property_id, name, mime, data, storage_key, is_public, uploaded_by, size from files where id = ${id} and state = 'ready'`;
  if (!f || !(await canReadFile(f, url.searchParams))) return new NextResponse("Not found", { status: 404 });
  const viewable = f.mime.startsWith("image/") || f.mime === "application/pdf";
  const inline = viewable && url.searchParams.get("download") !== "1";
  if (f.storage_key) {
    // bytes never pass through the app: send the browser to a short-lived signed link in object storage
    const link = await signedDownload(f.storage_key, f.is_public ? 3600 : 60, inline ? undefined : f.name);
    return NextResponse.redirect(link, { status: 302, headers: { "Cache-Control": f.is_public ? "public, max-age=1800" : "private, no-store" } });
  }
  if (!f.data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(f.data), { headers: {
    "Content-Type": f.mime,
    "Content-Disposition": disposition(inline ? "inline" : "attachment", f.name),
    "Cache-Control": f.is_public ? "public, max-age=86400" : "private, no-store",
    // PDFs need the browser's own viewer, which a sandboxed document can't load; everything else stays locked down
    "Content-Security-Policy": f.mime === "application/pdf" ? "default-src 'none'; object-src 'self'; frame-ancestors 'self'" : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'self'",
  } });
}
