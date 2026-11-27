import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { tenant } from "@/lib/db";
import { checkFile, MAX_UPLOAD } from "@/lib/files";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { uploadTarget } from "@/lib/upload-auth";
import { usesObjectStorage, makeKey, signedUpload } from "@/lib/storage";

/**
 * Step 1 of a direct upload: check who may upload and what, then hand back a one-time signed URL so the browser
 * sends the bytes straight to object storage (nothing large passes through Vercel). Without object storage the
 * answer is { direct: false } and the browser posts to /api/upload instead.
 */
export async function POST(req: Request) {
  if (!usesObjectStorage()) return NextResponse.json({ direct: false });
  if (!(await rateLimit(`upload:${await clientIp()}`, 60, 3600))) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { purpose?: string; code?: string; name?: string; size?: number; type?: string } | null;
  const name = String(body?.name ?? "").slice(0, 200), size = Number(body?.size ?? 0);
  if (!name || !(size > 0)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (size > MAX_UPLOAD) return NextResponse.json({ error: "Files can be at most 10 MB." }, { status: 413 });
  const t = await uploadTarget({ purpose: body?.purpose, code: body?.code });
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: t.status });
  const c = checkFile(name, String(body?.type ?? ""), null, { imagesOnly: t.imagesOnly });
  if ("error" in c) return NextResponse.json(c, { status: 415 });
  const id = randomUUID();
  const key = makeKey(t.propertyId, t.folder, id, name);
  const { url } = await signedUpload(key);
  await tenant({ propertyId: t.propertyId, userId: null }, (tx) => tx`
    insert into files (id, property_id, form_id, uploaded_by, is_public, name, mime, size, storage_key, state)
    values (${id}, ${t.propertyId}, ${t.formId}, ${t.uploadedBy}, ${t.isPublic}, ${name}, ${c.mime}, ${size}, ${key}, 'uploading')`);
  return NextResponse.json({ direct: true, fileId: id, uploadUrl: url, contentType: c.mime });
}
