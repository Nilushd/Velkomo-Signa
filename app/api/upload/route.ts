import { NextResponse } from "next/server";
import { tenant } from "@/lib/db";
import { checkFile, MAX_UPLOAD } from "@/lib/files";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { uploadTarget } from "@/lib/upload-auth";
import { usesObjectStorage, makeKey, putObject } from "@/lib/storage";
import { randomUUID } from "crypto";

/**
 * Upload through the app (multipart). Used when object storage isn't configured (local development), and for
 * small files; on Vercel the browser normally uses /api/upload/start → direct upload → /api/upload/finish.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`upload:${await clientIp()}`, 60, 3600))) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Files can be at most 10 MB." }, { status: 413 });
  const t = await uploadTarget({ purpose: fd.get("purpose") as string | null, code: fd.get("code") as string | null });
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: t.status });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const c = checkFile(file.name, file.type, bytes, { imagesOnly: t.imagesOnly });
  if ("error" in c) return NextResponse.json(c, { status: 415 });
  const id = randomUUID();
  const key = usesObjectStorage() ? makeKey(t.propertyId, t.folder, id, file.name) : null;
  if (key) await putObject(key, bytes, c.mime);
  await tenant({ propertyId: t.propertyId, userId: null }, (tx) => tx`
    insert into files (id, property_id, form_id, uploaded_by, is_public, name, mime, size, data, storage_key, state, attached_at)
    values (${id}, ${t.propertyId}, ${t.formId}, ${t.uploadedBy}, ${t.isPublic}, ${file.name.slice(0, 200)}, ${c.mime}, ${file.size},
      ${key ? null : Buffer.from(bytes)}, ${key}, 'ready', ${t.isPublic ? new Date() : null})`);
  return NextResponse.json({ fileId: id, name: file.name, size: file.size });
}
