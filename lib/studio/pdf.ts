"use client";
/** Read a sample PDF in the browser: text lines (with font size), fillable form fields, and page previews. */
import type { StudioLine } from "./parse";
import type { Field } from "../types";

interface TextItem { str: string; transform: number[]; width: number; height: number }
interface Widget { subtype: string; fieldType?: string; fieldName?: string; alternativeText?: string; checkBox?: boolean; radioButton?: boolean;
  buttonValue?: string; exportValue?: string; options?: { displayValue?: string; exportValue?: string }[]; multiLine?: boolean; rect: number[] }

interface Positioned extends StudioLine { page: number; y: number; x: number }

const pretty = (name: string) => name.replace(/^.*\./, "").replace(/[_\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+\d+$/, "").trim()
  .replace(/^\w/, (c) => c.toUpperCase());

export interface PdfRead { lines: StudioLine[]; previews: string[]; pageCount: number; hasText: boolean; widgetCount: number }

export async function readPdf(data: ArrayBuffer, maxPages = 10): Promise<PdfRead> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, maxPages);
  const textLines: Positioned[] = [];
  const widgetLines: Positioned[] = [];
  const previews: string[] = [];

  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter((i) => i.str && i.str.trim())
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, size: Math.abs(i.transform[3]) || i.height || 10 }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    // group into lines by baseline
    const groups: (typeof items)[] = [];
    for (const it of items) {
      const g = groups.find((gr) => Math.abs(gr[0].y - it.y) <= Math.max(2, it.size * 0.45));
      if (g) g.push(it); else groups.push([it]);
    }
    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = "", end = -Infinity;
      for (const it of g) {
        const gap = it.x - end;
        if (cur && gap > it.size * 2.2) { cells.push(cur.trim()); cur = ""; }
        cur += (cur && gap > it.size * 0.15 && !cur.endsWith(" ") ? " " : "") + it.str;
        end = it.x + it.w;
      }
      if (cur.trim()) cells.push(cur.trim());
      const size = Math.max(...g.map((i) => i.size));
      textLines.push({ text: cells.join("  "), cells: cells.length > 1 ? cells : undefined, size, page: p, y: g[0].y, x: g[0].x });
    }

    // fillable form fields (AcroForm widgets)
    const annots = (await page.getAnnotations({ intent: "display" })) as Widget[];
    const radios = new Map<string, { w: Widget; opts: string[] }>();
    for (const a of annots) {
      if (a.subtype !== "Widget" || !a.fieldType || !a.fieldName) continue;
      const [x1, y1, , y2] = a.rect;
      const yMid = (y1 + y2) / 2;
      // label: tooltip, else the text just left of the field on the same line, else the field name
      const left = textLines.filter((l) => l.page === p && Math.abs(l.y - yMid) < 12 && l.x < x1).sort((u, v) => v.x - u.x)[0];
      const label = a.alternativeText?.trim() || (left ? (left.cells ? left.cells[left.cells.length - 1] : left.text) : "") || pretty(a.fieldName);
      if (a.fieldType === "Btn" && a.radioButton) {
        const r = radios.get(a.fieldName) ?? { w: a, opts: [] };
        if (a.buttonValue && !r.opts.includes(a.buttonValue)) r.opts.push(pretty(a.buttonValue));
        radios.set(a.fieldName, r);
        continue;
      }
      let hint: Partial<Field>;
      if (a.fieldType === "Tx") hint = a.multiLine ? { type: "textarea" } : {};
      else if (a.fieldType === "Btn") hint = { type: "checkbox", options: [] };
      else if (a.fieldType === "Ch") hint = { type: "select", options: (a.options ?? []).map((o) => o.displayValue || o.exportValue || "").filter(Boolean) };
      else if (a.fieldType === "Sig") hint = { type: "signature" };
      else continue;
      widgetLines.push({ text: `${label}: ____`, hint, page: p, y: yMid, x: x1 });
    }
    for (const [name, r] of radios) {
      const [x1, y1, , y2] = r.w.rect;
      widgetLines.push({ text: `${r.w.alternativeText?.trim() || pretty(name)}: ____`, hint: { type: "radio", options: r.opts }, page: p, y: (y1 + y2) / 2, x: x1 });
    }

    if (p <= 4) {
      const vp = page.getViewport({ scale: 1 });
      const scale = 700 / vp.width;
      const canvas = document.createElement("canvas");
      const v2 = page.getViewport({ scale });
      canvas.width = v2.width; canvas.height = v2.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: v2, canvas } as never).promise;
      previews.push(canvas.toDataURL("image/jpeg", 0.8));
    }
  }
  const hasText = textLines.length > 0;
  let merged: Positioned[] = textLines;
  if (widgetLines.length >= 2) {
    // fillable PDF: the form fields are the fields; text gives title, headings, instructions, sign-off
    const used = new Set(widgetLines.map((w) => w.text.replace(/: ____$/, "").toLowerCase().replace(/[:*\s]+$/, "")));
    const keep = textLines.filter((l) => {
      const parts = (l.cells ?? [l.text]).map((c) => c.toLowerCase().replace(/[:*\s_]+$/, ""));
      return !parts.every((c) => used.has(c));
    }).map((l) => ({ ...l, cells: l.cells?.filter((c) => !used.has(c.toLowerCase().replace(/[:*\s_]+$/, ""))) }));
    merged = [...keep, ...widgetLines];
  }
  merged.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  return { lines: merged.map(({ text, cells, size, hint }) => ({ text, cells: cells && cells.length > 1 ? cells : undefined, size, hint })), previews, pageCount: doc.numPages, hasText, widgetCount: widgetLines.length };
}
