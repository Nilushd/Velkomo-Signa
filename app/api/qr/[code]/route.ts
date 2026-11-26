import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { rootSql } from "@/lib/db";
import { appUrl } from "@/lib/env";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [f] = await rootSql()<{ short_code: string; title: string }[]>`select short_code, title from forms where short_code = ${code}`;
  if (!f) return new NextResponse("Not found", { status: 404 });
  const u = new URL(req.url);
  const link = `${appUrl()}/f/${f.short_code}`;
  const opts = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: "#0B1F4D", light: "#FFFFFF" } };
  const name = `${f.title.replace(/[^\w-]+/g, "-").toLowerCase()}-qr`;
  const dl: Record<string, string> = u.searchParams.get("download") ? { "Content-Disposition": `attachment; filename="${name}.${u.searchParams.get("format") === "svg" ? "svg" : "png"}"` } : {};
  if (u.searchParams.get("format") === "svg") {
    const svg = await QRCode.toString(link, { ...opts, type: "svg" });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", ...dl } });
  }
  const png = await QRCode.toBuffer(link, { ...opts, width: 1024 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", ...dl } });
}
