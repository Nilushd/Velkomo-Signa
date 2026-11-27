import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { getSession, asUser, asSystem } from "@/lib/auth";
import { rootSql, type Sql } from "@/lib/db";
import { sha256, fingerprint } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { loadDetail } from "@/lib/submission-view";
import { headerLogo } from "@/lib/types";
import { buildPdf, type PdfItem } from "@/lib/pdf/render";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { fileBytes } from "@/lib/file-access";

export const maxDuration = 60;
const MAX = 100;

/**
 * GET /api/pdf?ids=<id>,<id>…&format=pdf|zip
 *   Signed-in users: any submissions they may see (Row Level Security decides; others are skipped).
 *   Public requesters: ?ids=<one id>&s=<status token>.
 * format=pdf (default) → one PDF, each form on new pages; format=zip → one PDF per form.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/.test(x)))];
  if (!ids.length) return NextResponse.json({ error: "Choose at least one submission." }, { status: 400 });
  if (ids.length > MAX) return NextResponse.json({ error: `At most ${MAX} at a time.` }, { status: 400 });
  if (!(await rateLimit(`pdf:${await clientIp()}`, 60, 600))) return NextResponse.json({ error: "Too many downloads. Please wait a few minutes." }, { status: 429 });
  const zip = url.searchParams.get("format") === "zip";
  const token = url.searchParams.get("s");

  let printedBy = "requester";
  let run: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;
  if (token) {
    if (ids.length !== 1) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const [t] = await rootSql()<{ submission_id: string; property_id: string }[]>`select submission_id, property_id from status_tokens where token_hash = ${sha256(token)}`;
    if (!t || t.submission_id !== ids[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    run = (fn) => asSystem(t.property_id, fn);
  } else {
    const u = await getSession();
    if (!u || u.must_change_password) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    printedBy = u.name;
    run = (fn) => asUser(u, fn);
  }

  const items = await run(async (tx) => {
    const [p] = await tx<{ name: string; logo_file_id: string | null }[]>`select name, logo_file_id from properties limit 1`;
    const out: PdfItem[] = [];
    const logos = new Map<string, { bytes: Uint8Array; mime: string } | null>();
    for (const id of ids) {
      const d = await loadDetail(tx, id);
      if (!d) continue; // not visible to this user
      const logoId = headerLogo(d.form.theme, p?.logo_file_id);
      if (logoId && !logos.has(logoId)) {
        const [f] = await tx<{ data: Buffer | null; storage_key: string | null; mime: string }[]>`select data, storage_key, mime from files where id = ${logoId}`;
        const bytes = f ? await fileBytes(f) : null;
        logos.set(logoId, bytes ? { bytes, mime: f.mime } : null);
      }
      out.push({ d, propertyName: p?.name ?? "", logo: logoId ? logos.get(logoId) ?? null : null,
        verifyUrl: `${appUrl()}/v/${d.sub.verify_code}`, verifyPage: `${appUrl()}/verify`, fingerprint: fingerprint(d.sub.ref_no, d.sub.version, d.sub.data) });
    }
    return out;
  });
  if (!items.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/[^\w.-]+/g, "-");
  if (zip) {
    const files: Record<string, Uint8Array> = {};
    for (const it of items) files[`${safe(it.d.sub.ref_no)}${it.d.sub.version > 1 ? `-v${it.d.sub.version}` : ""}.pdf`] = await buildPdf([it], printedBy, `${it.d.form.title} ${it.d.sub.ref_no}`);
    return new NextResponse(zipSync(files, { level: 0 }) as unknown as BodyInit, { headers: {
      "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="submissions-${stamp}.zip"`, "Cache-Control": "private, no-store" } });
  }
  const pdf = await buildPdf(items, printedBy, items.length === 1 ? `${items[0].d.form.title} ${items[0].d.sub.ref_no}` : `Submissions ${stamp}`);
  const name = items.length === 1 ? `${safe(items[0].d.sub.ref_no)}.pdf` : `submissions-${stamp}-${items.length}.pdf`;
  return new NextResponse(pdf as unknown as BodyInit, { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
