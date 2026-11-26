/**
 * Form Studio: turn the text layout of a sample form (from a PDF or an Excel sheet) into a draft design.
 * Rules only — no AI. Works on "lines": each is one row of the sample, optionally split into cells
 * (Excel cells, or PDF text pieces separated by a wide gap).
 */
import type { Field, FieldType } from "../types";

export interface StudioLine {
  text: string;
  cells?: string[];
  /** font size (PDF); used to spot the title and section headings */
  size?: number;
  /** known facts about the field on this line (from a fillable PDF's form fields) */
  hint?: Partial<Field>;
}

export interface StudioDraft {
  title: string;
  description: string;
  formCode: string;
  fields: Field[];
  /** suggested approval level names, from "Checked by / Approved by" lines */
  steps: string[];
  notes: string[];
  source: "pdf-fields" | "pdf-text" | "excel-table" | "excel-form" | "ai";
}

const BOX_RE = /[☐☑☒□■◻◼❑❒○●◯]|\[\s?[xX✓✔]?\s?\]|\(\s?\)/;
const BOX_SPLIT = /[☐☑☒□■◻◼❑❒○●◯]|\[\s?[xX✓✔]?\s?\]|\(\s?\)/g;
const BLANK_RUN = /_{3,}|\.{4,}|…{2,}|-{5,}/;
const BLANK_SPLIT = /_{3,}|\.{4,}|…{2,}|-{5,}/g;
const PAGE_RE = /^(page\s*\d+(\s*(of|\/)\s*\d+)?|\d+\s*\/\s*\d+)$/i;
const SIGNOFF_RE = /\b(prepared|requested|submitted|checked|verified|reviewed|recommended|endorsed|approved|authori[sz]ed|accepted|received)\s+by\b/i;
const SIGNOFF_PARTS = /^(name|signature|sign|date|designation|position|title|dept\.?|department|emp\.?\s*no\.?)$/i;
const CODE_LABEL = /^(form|doc(ument)?|ref(erence)?)\s*(no\.?|number|code|#)\s*[:.\-]?\s*/i;
const CODE_RE = /\b[A-Z]{2,6}(?:[-/][A-Z0-9]{1,6}){1,4}(?:\s*(?:Rev|Ver|Issue|v)\.?\s*\d+[A-Z0-9.]*)?\b/;

export function guessType(label: string): FieldType {
  const l = label.toLowerCase();
  if (/\bsign(ature)?\b|\bsigned\b/.test(l)) return "signature";
  if (/e-?mail/.test(l)) return "email";
  if (/phone|mobile|\btel\b|telephone|contact\s*(no|number)|whats\s?app/.test(l)) return "phone";
  if (/attach|upload|copy of|supporting doc|photo(graph)?\b|scan(ned)? copy/.test(l)) return "file";
  if (/\bdate\b|\bdob\b|birth|arrival|departure|check[\s-]?(in|out)\b|valid (until|till)|expiry|\bfrom\b.*\bdate|effective/.test(l)) return "date";
  if (/amount|cost|price|total|\bqty\b|quantity|no\.? of|number of|\bdays?\b|nights?|\brate\b|budget|value|salary|\bpax\b|\bage\b|\((rs|lkr|usd|eur|\$)|\b(rs|lkr|usd)\b/.test(l)) return "number";
  if (/reason|remark|comment|description|details|justification|address|notes?\b|purpose|explain|specify/.test(l)) return "textarea";
  return "text";
}

function cleanLabel(raw: string): { label: string; required: boolean } {
  let s = raw.replace(/\s+/g, " ").trim();
  const required = /\*|\((required|mandatory)\)/i.test(s);
  s = s.replace(/\((required|mandatory)\)/gi, "").replace(/\*/g, "")
    .replace(/^(\d{1,2}[.)]|[a-z][.)]|[ivx]{1,4}[.)]|[-–•·▪])\s+/i, "")   // "1." "a)" "iv." "•"
    .replace(/[:：]\s*$/, "").replace(/\s*[:：]$/, "").trim();
  return { label: s, required };
}

const isCaps = (s: string) => { const letters = s.replace(/[^A-Za-z]/g, ""); return letters.length >= 3 && letters === letters.toUpperCase(); };
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function stepName(line: string): string | null {
  const m = line.match(SIGNOFF_RE);
  if (!m) return null;
  const verb = m[1].toLowerCase();
  if (["prepared", "requested", "submitted", "received"].includes(verb)) return null; // the requester, not an approver
  const role = (line.slice(m.index! + m[0].length).match(/^\s*[:(\-–]?\s*([A-Za-z][A-Za-z &/.]{1,30}?)\s*\)?\s*(?:[:_.]|$)/)?.[1] ?? "").trim();
  const noun: Record<string, string> = { checked: "Check", verified: "Verification", reviewed: "Review", recommended: "Recommendation", endorsed: "Endorsement",
    approved: "Approval", authorized: "Authorization", authorised: "Authorization", accepted: "Acceptance" };
  const n = noun[verb] ?? "Approval";
  return role && !SIGNOFF_PARTS.test(role) && words(role) <= 4 ? `${role} ${n.toLowerCase()}` : n;
}

let seq = 0;
const fid = () => `f_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function makeField(rawLabel: string, extra: Partial<Field> = {}): Field | null {
  const { label, required } = cleanLabel(rawLabel);
  if (!label || label.length > 120 || !/[A-Za-z]/.test(label)) return null;
  const type = extra.type ?? guessType(label);
  const f: Field = { id: fid(), type, label, required, ...extra };
  if (type === "file" && /\b(copies|documents|files|attachments|photos)\b/i.test(label)) { f.multiple = true; f.maxFiles = 5; }
  return f;
}

/** "Label ☐ A ☐ B" or "☐ A ☐ B" → options (and the label before the first box, if any). */
function parseChoices(text: string) {
  const first = text.search(BOX_RE);
  const label = text.slice(0, first);
  const options = text.slice(first).split(BOX_SPLIT).map((o) => o.replace(/[:;,]+$/, "").trim()).filter((o) => o && o.length <= 60);
  return { label, options };
}

function choiceField(label: string, options: string[]): Field | null {
  if (options.length === 0) return null;
  const yesNo = options.length === 2 && options.every((o) => /^(yes|no|y|n)$/i.test(o));
  const exclusive = yesNo || /\b(tick one|select one|choose one|one only)\b/i.test(label) || /^(male|female)$/i.test(options[0]) ||
    /\b(priority|gender|status|type|category|grade|size|method|mode|shift|title)\b/i.test(label);
  return makeField(label || "Options", { type: options.length === 1 ? "checkbox" : exclusive ? "radio" : "checkbox", options: options.length === 1 ? [] : options, ...(options.length === 1 ? { label: options[0] } : {}) }) ??
    null;
}

/** Split one line into field labels: "Name: ____ Date: ____" → Name, Date. */
function labelsInLine(line: StudioLine): string[] | null {
  if (line.cells && line.cells.length > 1) {
    const out: string[] = [];
    const c = line.cells.map((x) => x.trim());
    for (let i = 0; i < c.length; i++) {
      const t = c[i];
      if (!t || !t.replace(BLANK_SPLIT, "").trim()) continue;          // empty / "_____" = the answer space
      if (BOX_RE.test(t)) continue;
      if (BLANK_RUN.test(t)) { out.push(...t.split(BLANK_SPLIT).map((x) => x.trim()).filter(Boolean)); continue; }
      out.push(t);
      // "Guest name: | John Silva" — the cell after a "Label:" is sample data, not another field
      if (/[:：]\s*$/.test(t) && c[i + 1] && !/[:：]\s*$/.test(c[i + 1]) && !BLANK_RUN.test(c[i + 1])) i++;
    }
    return out.length ? out : null;
  }
  const t = line.text;
  if (BLANK_RUN.test(t)) return t.split(BLANK_SPLIT).map((x) => x.trim()).filter((x) => x && /[A-Za-z]/.test(x));
  const colon = t.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
  if (colon && words(colon[1]) <= 8) {
    // "Name: John  Room: 101" → Name, Room ; "Name:" → Name
    const rest = colon[2];
    const more = [...rest.matchAll(/(?:^|\s{2,}|\s)([A-Z][A-Za-z ./&]{1,30})[:：]/g)].map((m) => m[1]);
    return [colon[1], ...more];
  }
  return null;
}

export function parseLines(input: StudioLine[], source: StudioDraft["source"] = "pdf-text"): StudioDraft {
  const notes: string[] = [];
  const lines = input.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text && !PAGE_RE.test(l.text));
  const sizes = lines.map((l) => l.size).filter((s): s is number => !!s).sort((a, b) => a - b);
  const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;

  // ---- title: the largest text among the first lines, else the first short line
  let titleIdx = -1;
  const head = lines.slice(0, 8);
  if (body) {
    const max = Math.max(...head.map((l) => l.size ?? 0));
    if (max > body * 1.15) titleIdx = lines.findIndex((l) => l.size === max);
  }
  if (titleIdx < 0) titleIdx = head.findIndex((l) => l.text.length <= 70 && !labelsInLine(l) && !BOX_RE.test(l.text) && !CODE_LABEL.test(l.text));
  let title = titleIdx >= 0 ? lines[titleIdx].text : "";
  // a hotel name on top, the form name below it: prefer the line containing "form/request/application"
  const better = head.findIndex((l, i) => i !== titleIdx && l.text.length <= 70 && /\b(form|request|requisition|application|voucher|slip|checklist|report|permit|order|claim)\b/i.test(l.text) && !labelsInLine(l));
  if (better >= 0 && !/\b(form|request|requisition|application|voucher|slip|checklist|report|permit|order|claim)\b/i.test(title)) { titleIdx = better; title = lines[better].text; }
  title = title.replace(/[:：]$/, "").trim();
  if (title && isCaps(title)) title = title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  let formCode = "";
  const fields: Field[] = [];
  const steps: string[] = [];
  const desc: string[] = [];
  let inSignoff = false;
  let pendingQuestion: string | null = null;
  let skipped = 0;

  lines.forEach((line, i) => {
    if (i === titleIdx) return;
    const t = line.text;

    // document-control code: "Form No: HR-F-012 Rev 2" or a bare code in the header
    if (CODE_LABEL.test(t) || (i < 6 && !formCode && CODE_RE.test(t) && words(t) <= 6)) {
      const m = t.replace(CODE_LABEL, "").match(CODE_RE);
      if (m && !formCode) { formCode = m[0]; return; }
    }

    // sign-off block → approval levels (not fields)
    // header text above the title (hotel name, address) is not a field
    if (i < titleIdx && !labelsInLine(line) && !BOX_RE.test(t)) return;

    // "Requested by: ____" is the requester's own field; only approver rows ("Checked by", "Approved by"…) are sign-off
    const approverRow = [...t.matchAll(new RegExp(SIGNOFF_RE.source, "gi"))].some((m) => !/^(prepared|requested|submitted|received)$/i.test(m[1]));
    if (approverRow) {
      inSignoff = true;
      // one line can hold several: "Recommended by HOD   Approved by GM"
      const starts = [...t.matchAll(new RegExp(SIGNOFF_RE.source, "gi"))].map((m) => m.index!);
      starts.forEach((st, k) => {
        const name = stepName(t.slice(st, starts[k + 1] ?? t.length));
        if (name && !steps.includes(name) && steps.length < 5) steps.push(name);
      });
      return;
    }
    if (inSignoff) {
      const parts = (line.cells ?? t.split(/\s{2,}|\|/)).map((p) => cleanLabel(p.replace(BLANK_SPLIT, "")).label).filter(Boolean);
      if (parts.length && parts.every((p) => SIGNOFF_PARTS.test(p) || stepName(p))) return;
      inSignoff = false;
    }

    // a row of cells mixing labels and check boxes: "Quotation attached | ☐ Yes ☐ No"
    if (line.cells && line.cells.some((c) => BOX_RE.test(c)) && line.cells.some((c) => c.trim() && !BOX_RE.test(c))) {
      const labels: string[] = [];
      for (const c of line.cells.map((x) => x.trim())) {
        if (!c || !c.replace(BLANK_SPLIT, "").trim()) continue;
        if (BOX_RE.test(c)) {
          const { label, options } = parseChoices(c);
          const f = choiceField(label.trim() || labels.pop() || "", options);
          if (f) fields.push(f);
        } else labels.push(c);
        // flush plain labels that come before the next box-cell's own label
        while (labels.length > 1) { const f = makeField(labels.shift()!); if (f) fields.push(f); }
      }
      for (const l of labels) { const f = makeField(l); if (f) fields.push(f); }
      return;
    }

    // check boxes
    if (BOX_RE.test(t)) {
      const { label, options } = parseChoices(t);
      const lab = label.trim() || pendingQuestion || "";
      const f = line.hint?.type ? makeField(lab || "Options", { ...line.hint, options: line.hint.options ?? options }) : choiceField(lab, options);
      if (f) { fields.push(f); pendingQuestion = null; } else skipped++;
      return;
    }

    // section headings: ALL CAPS, numbered "1. GUEST DETAILS", "Section B", or larger font
    const short = t.length <= 60 && !/[:：]\s*\S/.test(t) && !BLANK_RUN.test(t);
    const bigger = !!(body && line.size && line.size > body * 1.12);
    if (short && (isCaps(t) || /^(section|part)\s+[A-Z0-9]+\b/i.test(t) || bigger) && !/[:：]$/.test(t) && words(t) <= 8) {
      const { label } = cleanLabel(t);
      fields.push({ id: fid(), type: "heading", label: isCaps(label) ? label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : label });
      pendingQuestion = null;
      return;
    }

    // fields
    const labels = labelsInLine(line);
    if (labels && labels.length) {
      if (labels.length === 1 && /[?:：]\s*$/.test(t) && !BLANK_RUN.test(t) && i + 1 < lines.length && BOX_RE.test(lines[i + 1].text) && !lines[i + 1].text.split(BOX_RE)[0].trim()) {
        pendingQuestion = labels[0]; return; // a question whose answers (boxes) follow on the next line
      }
      for (const l of labels) { const f = makeField(l, labels.length === 1 ? line.hint : undefined); if (f) fields.push(f); else skipped++; }
      return;
    }

    // a long sentence: instructions → description
    if (t.length > 70 || words(t) > 12) { if (desc.length < 3) desc.push(t); else skipped++; return; }

    // a short line on its own (common in boxed/table forms): treat it as a field label
    if (words(t) <= 6 && /^[A-Z0-9(]/.test(t)) { const f = makeField(t); if (f) { fields.push(f); return; } }
    skipped++;
  });

  // tidy: drop duplicate labels next to each other, and headings with nothing under them
  const tidy = fields.filter((f, i) => {
    const prev = fields[i - 1];
    if (prev && prev.label.toLowerCase() === f.label.toLowerCase() && prev.type === f.type) return false;
    if (f.type === "heading" && (!fields[i + 1] || fields[i + 1].type === "heading")) return false;
    return true;
  });
  if (steps.length) notes.push(`Found a sign-off block — suggested ${steps.length} approval level${steps.length > 1 ? "s" : ""}: ${steps.join(", ")}. Pick the approvers after creating the form.`);
  if (skipped) notes.push(`${skipped} line${skipped > 1 ? "s" : ""} didn't look like a field and ${skipped > 1 ? "were" : "was"} left out.`);
  if (!title) notes.push("No title found — please type one.");
  return { title: title || "Untitled form", description: desc.join("\n"), formCode, fields: tidy, steps, notes, source };
}

/** Excel helpers: is this sheet a data table (header row + data rows) rather than a laid-out form? */
export function looksLikeTable(rows: unknown[][]): boolean {
  const nonEmpty = rows.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (nonEmpty.length < 3) return false;
  const head = nonEmpty[0].map((c) => String(c ?? "").trim());
  const cols = head.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  if (cols.length < 3) return false;
  const filled = nonEmpty.slice(1, 6).map((r) => cols.filter((i) => String(r[i] ?? "").trim()).length / cols.length);
  return filled.filter((x) => x >= 0.5).length >= Math.min(2, filled.length);
}

/** Excel rows of a laid-out form → lines with cells. */
export function rowsToLines(rows: unknown[][]): StudioLine[] {
  return rows.map((r) => {
    const raw = r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? "").trim()));
    // keep empty cells that follow a label (they mean "write here"), squash the rest
    const cells: string[] = [];
    raw.forEach((c, i) => { if (c || (cells.length && cells[cells.length - 1] !== "" && i > 0)) cells.push(c); });
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    return { text: raw.filter(Boolean).join("  "), cells: cells.length > 1 ? [...cells, ""] : undefined };
  }).filter((l) => l.text);
}
