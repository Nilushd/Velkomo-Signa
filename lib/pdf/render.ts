/**
 * Server-side PDF of submitted forms (pdf-lib). Same content as the print view: hotel header, document number,
 * verification code + QR, status stamp, every answer (signatures as images, attachments listed), approval record,
 * fingerprint and page numbers. Several submissions can go into one PDF, each starting on a new page.
 */
import { readFileSync } from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import type { Detail } from "../submission-view";
import type { Field } from "../types";
import { formatValue, fileRefs, fmtDate } from "../format";

const W = 595.28, H = 841.89, M = 40, FOOT = 58;
const C = { ink: rgb(0.06, 0.09, 0.16), soft: rgb(0.2, 0.25, 0.33), mute: rgb(0.36, 0.42, 0.53), line: rgb(0.89, 0.91, 0.94), wash: rgb(0.96, 0.97, 0.99) };
const STAMP: Record<string, [string, RGB]> = {
  approved: ["APPROVED", rgb(0.02, 0.47, 0.34)], pending: ["PENDING APPROVAL", rgb(0.71, 0.33, 0.04)],
  rejected: ["REJECTED", rgb(0.73, 0.11, 0.11)], withdrawn: ["WITHDRAWN", rgb(0.32, 0.32, 0.36)],
};

function hex(h: string | undefined, fallback: RGB): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(h ?? "");
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
function fontBytes() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "assets/fonts");
    fontCache = { regular: readFileSync(path.join(dir, "DejaVuSans.ttf")), bold: readFileSync(path.join(dir, "DejaVuSans-Bold.ttf")) };
  }
  return fontCache;
}

export interface PdfItem {
  d: Detail;
  propertyName: string;
  logo: { bytes: Uint8Array; mime: string } | null;
  verifyUrl: string;
  verifyPage: string;
  fingerprint: string;
}

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  private chars: Set<number>;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont) {
    this.chars = new Set(font.getCharacterSet());
  }
  /** Replace characters the embedded font can't draw, so a stray emoji never breaks the PDF. */
  clean(s: string) {
    return [...s.replace(/\r/g, "")].map((ch) => (ch === "\n" || this.chars.has(ch.codePointAt(0)!) ? ch : "?")).join("");
  }
  newPage() { this.page = this.doc.addPage([W, H]); this.pages.push(this.page); this.y = H - M; }
  ensure(h: number) { if (this.y - h < M + FOOT) this.newPage(); }
  wrap(text: string, f: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of this.clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        if (!word) continue;
        const next = line + word;
        if (f.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
        if (line.trim()) out.push(line.trimEnd());
        line = word.trimStart();
        while (f.widthOfTextAtSize(line, size) > width) { // a single very long word
          let i = line.length;
          while (i > 1 && f.widthOfTextAtSize(line.slice(0, i), size) > width) i--;
          out.push(line.slice(0, i)); line = line.slice(i);
        }
      }
      out.push(line.trimEnd());
    }
    return out.length ? out : [""];
  }
  text(s: string, x: number, y: number, size: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    this.page.drawText(this.clean(s), { x, y, size, font: opts.font ?? this.font, color: opts.color ?? C.ink });
  }
  lines(ls: string[], x: number, y: number, size: number, lh: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    ls.forEach((l, i) => this.text(l, x, y - i * lh, size, opts));
  }
  hr(y: number, color = C.line, thickness = 0.6) { this.page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color }); }
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array, mime: string): Promise<PDFImage | null> {
  try {
    if (mime === "image/png") return await doc.embedPng(bytes);
    if (mime === "image/jpeg") return await doc.embedJpg(bytes);
  } catch { /* unreadable image: leave it out */ }
  return null;
}

async function renderOne(w: Writer, item: PdfItem, printedBy: string) {
  const { d } = item;
  const { sub, form } = d;
  const theme = form.theme;
  const primary = hex(theme.primary, rgb(0.15, 0.39, 0.92));
  w.pages = [];
  w.newPage();
  const contentW = W - 2 * M;

  // ---- header: right block (document no + QR), left block (logo, hotel, title, code)
  const qrPng = await QRCode.toBuffer(item.verifyUrl, { margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: "#0F172A", light: "#FFFFFF" } });
  const qr = await w.doc.embedPng(qrPng);
  const qs = 74, qx = W - M - qs, top = w.y;
  w.page.drawImage(qr, { x: qx, y: top - qs, width: qs, height: qs });
  const rx = qx - 10;
  const right = (s: string, y: number, size: number, f = w.font, color = C.mute) => w.text(s, rx - f.widthOfTextAtSize(w.clean(s), size), y, size, { font: f, color });
  right("Document No.", top - 8, 7.5);
  right(sub.ref_no, top - 22, 12, w.bold, C.ink);
  let ry = top - 34;
  if (sub.version > 1) { right(`Version ${sub.version}`, ry, 8, w.font, C.soft); ry -= 12; }
  right("Verification code", ry - 2, 7.5); right(sub.verify_code, ry - 14, 9.5, w.bold, C.ink);

  const leftW = rx - M - 150;
  let ly = top;
  const logo = item.logo ? await embedImage(w.doc, item.logo.bytes, item.logo.mime) : null;
  if (logo) {
    const h = { s: 26, m: 40, l: 56 }[theme.logoSize ?? "m"];
    const dims = logo.scale(h / logo.height);
    const lw = Math.min(dims.width, 170), lh = (lw / dims.width) * h;
    w.page.drawImage(logo, { x: M, y: ly - lh, width: lw, height: lh });
    ly -= lh + 8;
  }
  if (theme.showPropertyName || !logo) { w.text(item.propertyName.toUpperCase(), M, ly - 8, 8, { font: w.bold, color: C.soft }); ly -= 14; }
  const titleLines = w.wrap(form.title, w.bold, 16, Math.max(leftW, 200));
  w.lines(titleLines, M, ly - 15, 16, 19, { font: w.bold }); ly -= 19 * titleLines.length + 2;
  if (theme.formCode) { w.text(theme.formCode, M, ly - 9, 8, { color: C.mute }); ly -= 13; }
  w.y = Math.min(ly, top - qs) - 10;
  w.page.drawLine({ start: { x: M, y: w.y }, end: { x: W - M, y: w.y }, thickness: 1.6, color: primary });
  w.y -= 16;

  // ---- who / when + status stamp
  const meta: [string, string][] = [["Submitted by", sub.submitter ?? ""], ["Submitted on", fmtDate(sub.created_at, true, d.tz)]];
  if (sub.version > 1) meta.push(["Last revised", fmtDate(sub.updated_at, true, d.tz)]);
  meta.forEach(([k, v], i) => { w.text(k, M, w.y - i * 13, 8.5, { color: C.mute }); w.text(v, M + 78, w.y - i * 13, 8.5, { font: i === 0 ? w.bold : w.font }); });
  const [label, sc] = STAMP[sub.status] ?? STAMP.pending;
  const decided = d.approvals.filter((a) => a.version === sub.version && (a.decision === "approved" || a.decision === "rejected")).at(-1);
  const sw = w.bold.widthOfTextAtSize(label, 11) + 22, sh = decided && sub.status !== "pending" ? 30 : 22;
  w.page.drawRectangle({ x: W - M - sw, y: w.y - sh + 10, width: sw, height: sh, borderColor: sc, borderWidth: 2 });
  w.text(label, W - M - sw + 11, w.y - 4, 11, { font: w.bold, color: sc });
  if (decided && sub.status !== "pending") { const t = fmtDate(decided.decided_at, false, d.tz); w.text(t, W - M - sw / 2 - w.font.widthOfTextAtSize(t, 7.5) / 2, w.y - 15, 7.5, { color: sc }); }
  w.y -= Math.max(meta.length * 13, sh) + 12;

  // ---- answers
  const labelW = contentW * 0.34, valX = M + labelW + 10, valW = contentW - labelW - 10;
  for (const f of form.schema as Field[]) {
    if (f.type === "heading") {
      w.ensure(28); w.y -= 8;
      w.lines(w.wrap(f.label, w.bold, 10.5, contentW), M, w.y - 10, 10.5, 13, { font: w.bold, color: primary });
      w.y -= 18; continue;
    }
    const v = sub.data[f.id];
    const lab = w.wrap(f.label, w.font, 9, labelW);
    let valLines: string[] = [];
    let sig: PDFImage | null = null;
    if (f.type === "signature" && typeof v === "string" && v.startsWith("data:image/png;base64,")) {
      sig = await embedImage(w.doc, Buffer.from(v.split(",")[1], "base64"), "image/png");
    } else if (f.type === "file") {
      const refs = fileRefs(v);
      valLines = refs.length ? refs.flatMap((r) => w.wrap(`• ${r.name} (${Math.max(1, Math.round(r.size / 1024))} KB)`, w.font, 9, valW)) : ["—"];
    } else {
      valLines = w.wrap(formatValue(f, v) || "—", w.font, 9, valW);
    }
    const sigH = sig ? 40 : 0;
    const rowH = Math.max(lab.length * 12, sig ? sigH : valLines.length * 12) + 9;
    if (rowH > H - 2 * M - FOOT) { // a very long answer: let it flow across pages
      w.ensure(30);
      w.lines(lab, M, w.y - 10, 9, 12, { color: C.soft });
      for (const l of valLines) { w.ensure(14); w.text(l, valX, w.y - 10, 9); w.y -= 12; }
      w.y -= 9; w.hr(w.y + 3); continue;
    }
    w.ensure(rowH);
    w.lines(lab, M, w.y - 10, 9, 12, { color: C.soft });
    if (sig) { const s = sig.scale(sigH / sig.height); w.page.drawImage(sig, { x: valX, y: w.y - sigH - 2, width: Math.min(s.width, valW), height: sigH }); }
    else w.lines(valLines, valX, w.y - 10, 9, 12, { color: valLines[0] === "—" ? C.mute : C.ink });
    w.y -= rowH;
    w.hr(w.y + 3);
  }

  // ---- approval record
  w.ensure(70); w.y -= 14;
  w.text("APPROVAL RECORD", M, w.y, 9, { font: w.bold, color: C.soft }); w.y -= 10;
  if (d.steps.length === 0) { w.text("No approval levels — accepted automatically on submission.", M, w.y - 10, 9, { color: C.mute }); w.y -= 20; }
  else {
    const cols = [0.27, 0.22, 0.12, 0.17, 0.22].map((p) => p * contentW);
    const xs = cols.map((_, i) => M + cols.slice(0, i).reduce((a, b) => a + b, 0));
    const head = ["Level", "Approver", "Decision", "Date & time", "Comment"];
    w.page.drawRectangle({ x: M, y: w.y - 16, width: contentW, height: 16, color: C.wash });
    head.forEach((h, i) => w.text(h.toUpperCase(), xs[i] + 4, w.y - 11, 7, { font: w.bold, color: C.mute }));
    w.y -= 16;
    const cur = d.approvals.filter((a) => a.version === sub.version);
    for (const s of d.steps) {
      const dec = cur.find((a) => a.level === s.level && (a.decision === "approved" || a.decision === "rejected"));
      const wait = cur.filter((a) => a.level === s.level && a.decision === "pending" && sub.status === "pending");
      const decision = dec ? (dec.decision === "approved" ? "Approved" : "Rejected") : wait.length ? "Waiting" : sub.status === "approved" ? "—" : "Not reached";
      const color = dec?.decision === "approved" ? rgb(0.02, 0.47, 0.34) : dec?.decision === "rejected" ? rgb(0.73, 0.11, 0.11) : rgb(0.71, 0.33, 0.04);
      const cells = [`${s.level} · ${s.name}`, dec ? dec.approver : wait.map((x) => x.approver).join(" / ") || "—", decision, dec ? fmtDate(dec.decided_at, true, d.tz) : "", dec?.comment ?? ""]
        .map((t, i) => w.wrap(t, i === 2 ? w.bold : w.font, 8.5, cols[i] - 8));
      const rh = Math.max(...cells.map((c) => c.length)) * 11 + 8;
      w.ensure(rh);
      cells.forEach((c, i) => w.lines(c, xs[i] + 4, w.y - 11, 8.5, 11, i === 2 ? { font: w.bold, color } : {}));
      w.y -= rh; w.hr(w.y);
    }
  }
  if (d.versions.length) { w.ensure(20); w.y -= 12; w.text(`This request was revised ${d.versions.length} time${d.versions.length > 1 ? "s" : ""}; earlier versions are kept in the system history.`, M, w.y, 8, { color: C.mute }); }

  // ---- footer on every page of this document
  const n = w.pages.length;
  const verify = `Verify: scan the QR code, or open ${item.verifyPage} and enter document number ${sub.ref_no} with verification code ${sub.verify_code}.`;
  const printed = `Fingerprint ${item.fingerprint} · Printed ${fmtDate(new Date(), true, d.tz)} by ${printedBy} · Velkomo Signa`;
  w.pages.forEach((p, i) => {
    w.page = p;
    let fy = M + FOOT - 14;
    p.drawLine({ start: { x: M, y: fy + 8 }, end: { x: W - M, y: fy + 8 }, thickness: 0.6, color: C.line });
    for (const l of w.wrap(verify, w.font, 7.5, contentW - 150)) { w.text(l, M, fy, 7.5, { color: C.soft }); fy -= 9.5; }
    for (const l of w.wrap(printed, w.font, 7, contentW - 150)) { w.text(l, M, fy, 7, { color: C.mute }); fy -= 9; }
    if (theme.printFooter) for (const l of w.wrap(theme.printFooter, w.font, 7, contentW - 150).slice(0, 2)) { w.text(l, M, fy, 7, { color: C.soft }); fy -= 9; }
    const pn = `${sub.ref_no} · Page ${i + 1} of ${n}`;
    w.text(pn, W - M - w.font.widthOfTextAtSize(pn, 7.5), M + FOOT - 14, 7.5, { color: C.mute });
  });
}

async function newDoc(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fb = fontBytes();
  const font = await doc.embedFont(fb.regular, { subset: true });
  const bold = await doc.embedFont(fb.bold, { subset: true });
  doc.setTitle(title); doc.setCreator("Velkomo Signa"); doc.setProducer("Velkomo Signa");
  return { doc, w: new Writer(doc, font, bold) };
}

/** One PDF holding every item, each starting on a new page. */
export async function buildPdf(items: PdfItem[], printedBy: string, title = "Submissions"): Promise<Uint8Array> {
  const { doc, w } = await newDoc(title);
  for (const it of items) await renderOne(w, it, printedBy);
  return doc.save();
}
