import { NextResponse } from "next/server";
import { getSession, asUser } from "@/lib/auth";
import { rootSql, tenant } from "@/lib/db";
import { formAccess, canSubmit } from "@/lib/access";
import { checkFile, MAX_UPLOAD } from "@/lib/files";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import type { FormRow } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await rateLimit(`upload:${await clientIp()}`, 60, 3600))) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Files can be at most 10 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const user = await getSession();

  if (fd.get("purpose") === "logo") {
    if (!user || !(user.is_admin || user.can_build_forms)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const c = checkFile(file.name, file.type, bytes, { imagesOnly: true });
    if ("error" in c) return NextResponse.json(c, { status: 415 });
    const [r] = await asUser(user, (tx) => tx<{ id: string }[]>`insert into files (property_id, uploaded_by, is_public, name, mime, size, data)
      values (${user.property_id}, ${user.id}, true, ${file.name.slice(0, 200)}, ${c.mime}, ${file.size}, ${Buffer.from(bytes)}) returning id`);
    return NextResponse.json({ fileId: r.id, name: file.name, size: file.size });
  }

  const code = String(fd.get("code") ?? "");
  const [form] = await rootSql()<FormRow[]>`select * from forms where short_code = ${code} and status = 'published'`;
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  const who = user && user.property_id === form.property_id ? user : null;
  const ok = await tenant({ propertyId: form.property_id, userId: null }, async (tx) => canSubmit(form, who, await formAccess(tx, who, form)));
  if (!ok) return NextResponse.json({ error: "You don't have access to this form" }, { status: 403 });
  const c = checkFile(file.name, file.type, bytes);
  if ("error" in c) return NextResponse.json(c, { status: 415 });
  const [r] = await tenant({ propertyId: form.property_id, userId: null }, (tx) => tx<{ id: string }[]>`
    insert into files (property_id, form_id, uploaded_by, name, mime, size, data)
    values (${form.property_id}, ${form.id}, ${who?.id ?? null}, ${file.name.slice(0, 200)}, ${c.mime}, ${file.size}, ${Buffer.from(bytes)}) returning id`);
  return NextResponse.json({ fileId: r.id, name: file.name, size: file.size });
}
