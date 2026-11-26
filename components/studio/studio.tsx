"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { FileSpreadsheet, FileText, Image as ImageIcon, Sparkles, Upload, Wand2, ArrowUp, ArrowDown, Trash2, Plus, RotateCcw, Heading, Send, Save } from "lucide-react";
import { parseLines, rowsToLines, looksLikeTable, type StudioDraft } from "@/lib/studio/parse";
import { fieldsFromRows } from "@/lib/detect";
import { FIELD_TYPES, CHOICE_TYPES, type Field, type FieldType } from "@/lib/types";
import { createForm, type StepInput, type AccessEntry } from "@/app/actions/forms";
import { LevelsEditor, approverOptions, stepProblem } from "../builder/approvals-tab";
import { Picker } from "../picker";
import { aiDesign } from "@/app/actions/studio";
import { FormRenderer } from "../form-renderer";
import { Alert } from "../ui";

type Kind = "pdf" | "excel" | "image";
interface Sample { name: string; kind: Kind; mime: string; file: File; previews: string[]; rows?: unknown[][]; sheets?: string[]; sheet?: string; hasText?: boolean; csv?: string }

const SOURCE_LABEL: Record<StudioDraft["source"], string> = {
  "pdf-fields": "PDF form fields", "pdf-text": "PDF layout", "excel-table": "Excel columns", "excel-form": "Excel layout", ai: "AI design",
};
let n = 0;
const newId = () => `f_s${++n}_${Math.random().toString(36).slice(2, 6)}`;

async function toBase64(file: File) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = ""; const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) s += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(s);
}

interface Person { id: string; name: string; username: string; department: string | null; email: string | null }
interface Group { id: string; name: string; members: number }
const toLevels = (names: string[]): StepInput[] => names.map((name) => ({ name, channel: "both", reminderDays: null, approvers: [] }));

export function Studio({ aiEnabled, aiConfigured, propertyName, propertyLogo, users, groups }:
  { aiEnabled: boolean; aiConfigured: boolean; propertyName: string; propertyLogo: string | null; users: Person[]; groups: Group[] }) {
  const [sample, setSample] = useState<Sample | null>(null);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excelMode, setExcelMode] = useState<"table" | "form">("form");
  const [view, setView] = useState<"original" | "preview">("original");
  const [creating, start] = useTransition();
  const [levels, setLevels] = useState<StepInput[]>([]);
  const [visibility, setVisibility] = useState<"assigned" | "all_users" | "public">("assigned");
  const [fillers, setFillers] = useState<string[]>([]);
  // every new design (rules or AI) brings its own suggested levels
  const setDraftAndLevels = (d: StudioDraft | null) => { setDraft(d); setLevels(toLevels(d?.steps ?? [])); };
  const input = useRef<HTMLInputElement>(null);

  async function runAi(s: Sample) {
    setBusy("The AI is reading your form…"); setError(null);
    try {
      const r = await aiDesign(s.kind === "excel" ? { name: s.name, mime: s.mime, text: s.csv } : { name: s.name, mime: s.mime, base64: await toBase64(s.file) });
      if ("error" in r) setError(r.error); else { setDraftAndLevels(r.draft); setView("preview"); }
    } catch { setError("AI design failed. Please try again."); }
    finally { setBusy(null); }
  }

  function designExcel(s: Sample, mode: "table" | "form", rows = s.rows!) {
    if (mode === "table") {
      const fields = fieldsFromRows(rows.filter((r) => r.some((c) => String(c ?? "").trim())));
      setDraftAndLevels({ title: s.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " "), description: "", formCode: "", fields, steps: [],
        notes: [`Read the first row as ${fields.length} column headings; types guessed from the rows below.`], source: "excel-table" });
    } else setDraftAndLevels(parseLines(rowsToLines(rows), "excel-form"));
  }

  async function onFile(file: File) {
    setError(null); setDraftAndLevels(null); setView("original");
    if (file.size > 10 * 1024 * 1024) { setError("Please use a file under 10 MB."); return; }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const kind: Kind | null = ext === "pdf" ? "pdf" : ["xlsx", "xls", "csv"].includes(ext) ? "excel" : ["png", "jpg", "jpeg", "webp"].includes(ext) ? "image" : null;
    if (!kind) { setError("Use an Excel (.xlsx, .csv), PDF, or image (PNG, JPG) file."); return; }
    const mime = kind === "pdf" ? "application/pdf" : kind === "image" ? (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg") : file.type;
    setBusy("Reading your sample…");
    try {
      if (kind === "excel") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const sheet = wb.SheetNames[0];
        const ws = wb.Sheets[sheet];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false, raw: true });
        if (!rows.length) throw new Error("The sheet is empty.");
        const s: Sample = { name: file.name, kind, mime, file, previews: [], rows, sheets: wb.SheetNames, sheet, csv: XLSX.utils.sheet_to_csv(ws) };
        (s as Sample & { wb?: unknown }).wb = wb;
        setSample(s);
        const mode = looksLikeTable(rows) ? "table" : "form";
        setExcelMode(mode); designExcel(s, mode, rows);
      } else if (kind === "pdf") {
        const { readPdf } = await import("@/lib/studio/pdf");
        const r = await readPdf(await file.arrayBuffer());
        const s: Sample = { name: file.name, kind, mime, file, previews: r.previews, hasText: r.hasText };
        setSample(s);
        if (!r.hasText) {
          if (aiEnabled) { setBusy(null); await runAi(s); return; }
          setError("This PDF is a scanned image with no text to read. Turn on AI design (ANTHROPIC_API_KEY) to read scans, or use the Excel/typed PDF version of the form.");
        } else {
          const d = parseLines(r.lines, r.widgetCount >= 2 ? "pdf-fields" : "pdf-text");
          if (r.widgetCount >= 2) d.notes.unshift(`Used the PDF's ${r.widgetCount} fillable form fields.`);
          if (r.pageCount > 10) d.notes.push(`Only the first 10 of ${r.pageCount} pages were read.`);
          setDraftAndLevels(d);
        }
      } else {
        const url = URL.createObjectURL(file);
        const s: Sample = { name: file.name, kind, mime, file, previews: [url] };
        setSample(s);
        if (aiEnabled) { setBusy(null); await runAi(s); return; }
        setError(aiConfigured ? "Photos and scans need AI design, which isn't switched on for your account. Ask your admin, or upload the Excel or a typed PDF version." : "Photos and scans need AI design, which isn't set up on this server (ANTHROPIC_API_KEY). Upload the Excel or a typed PDF version instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally { setBusy(null); }
  }

  async function switchSheet(name: string) {
    if (!sample) return;
    const XLSX = await import("xlsx");
    const wb = (sample as Sample & { wb: import("xlsx").WorkBook }).wb;
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false, raw: true });
    const s = { ...sample, sheet: name, rows, csv: XLSX.utils.sheet_to_csv(ws) };
    setSample(s); const mode = looksLikeTable(rows) ? "table" : "form"; setExcelMode(mode); designExcel(s, mode, rows);
  }

  // ---- draft editing helpers
  const setF = (fields: Field[]) => setDraft((d) => d && { ...d, fields });
  const upd = (i: number, p: Partial<Field>) => draft && setF(draft.fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => { if (!draft) return; const a = [...draft.fields]; [a[i], a[i + d]] = [a[i + d], a[i]]; setF(a); };

  function create(publish: boolean) {
    if (!draft) return;
    const bad = draft.fields.find((f) => ["select", "radio"].includes(f.type) && !(f.options ?? []).filter(Boolean).length);
    if (bad) { setError(`“${bad.label}” needs options (or change its type).`); return; }
    if (!draft.fields.some((f) => f.type !== "heading")) { setError("Add at least one field."); return; }
    const lv = levels.filter((l) => l.name.trim() || l.approvers.length);
    if (publish) { const p = stepProblem(lv); if (p) { setError(`To publish, ${p} Or save as a draft and finish later.`); return; } }
    const access: AccessEntry[] = visibility === "assigned"
      ? fillers.map((k) => (k.startsWith("u:") ? { userId: k.slice(2), access: "general" as const } : { groupId: k.slice(2), access: "general" as const })) : [];
    start(async () => {
      try {
        await createForm({ title: draft.title, description: draft.description, formCode: draft.formCode, publish, visibility, access,
          steps: lv.map((l) => ({ ...l, name: l.name.trim() || "Approval" })),
          schema: draft.fields.map((f) => ({ ...f, label: f.label.trim() || "Untitled", options: f.options?.map((o) => o.trim()).filter(Boolean) })), from: "studio" });
      } catch (e) { if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e; setError("Couldn't save the form. Please check the fields and try again."); }
    });
  }

  // ---------------------------------------------------------------- pick a sample
  if (!sample) {
    return (
      <div className="space-y-5">
        {error && <Alert kind="error">{error}</Alert>}
        <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          className="card flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed px-6 py-14 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
          <div className="flex gap-3 text-brand-600"><FileSpreadsheet className="h-9 w-9" /><FileText className="h-9 w-9" /><ImageIcon className="h-9 w-9" /></div>
          <span className="text-lg font-semibold">{busy ?? "Drop your sample form here, or click to choose"}</span>
          <span className="max-w-lg text-sm text-ink-mute">Excel (.xlsx, .csv), PDF — typed or fillable — or a photo/scan of the paper form{aiEnabled ? "" : " (photos need AI design)"}. Max 10 MB. The file isn&apos;t stored; only the design is saved.</span>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileSpreadsheet, t: "Excel", d: "A laid-out form (labels with blank cells) or a table whose column headings become fields." },
            { icon: FileText, t: "PDF", d: "Fillable PDFs use their real form fields; typed PDFs are read line by line — labels, ____ blanks, ☐ boxes, sections." },
            { icon: Sparkles, t: aiEnabled ? "AI design (on)" : "AI design (off)", d: aiEnabled ? "Reads photos and scans too, and can redo any design with AI." : aiConfigured ? "Not switched on for your account — ask your admin (Users → Feature access)." : "Add ANTHROPIC_API_KEY on the server to read photos and scans." },
          ].map((c) => (
            <div key={c.t} className="card p-4"><c.icon className="mb-2 h-5 w-5 text-brand-600" /><p className="font-semibold">{c.t}</p><p className="mt-1 text-sm text-ink-mute">{c.d}</p></div>))}
        </div>
        <p className="text-sm text-ink-mute">Prefer to start empty? <Link href="/forms/new" className="text-brand-700 hover:underline">Create a blank form</Link>.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- review
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-brand-50 py-1 text-brand-800 ring-1 ring-brand-200">{sample.kind === "excel" ? <FileSpreadsheet className="h-3.5 w-3.5" /> : sample.kind === "pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />} {sample.name}</span>
        {draft && <span className="text-sm text-ink-mute">Designed from: {SOURCE_LABEL[draft.source]}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {sample.kind === "excel" && sample.sheets && sample.sheets.length > 1 && (
            <select className="input w-auto py-1.5" value={sample.sheet} onChange={(e) => switchSheet(e.target.value)} aria-label="Sheet">{sample.sheets.map((s) => <option key={s}>{s}</option>)}</select>)}
          {sample.kind === "excel" && (
            <select className="input w-auto py-1.5" value={excelMode} onChange={(e) => { const m = e.target.value as "table" | "form"; setExcelMode(m); designExcel(sample, m); }} aria-label="Read the sheet as">
              <option value="form">Read as a laid-out form</option><option value="table">Read column headings as fields</option></select>)}
          {aiEnabled && <button className="btn-secondary" disabled={!!busy} onClick={() => runAi(sample)}><Sparkles className="h-4 w-4 text-brand-600" /> {draft?.source === "ai" ? "Redo with AI" : "Design with AI"}</button>}
          <button className="btn-ghost" onClick={() => { setSample(null); setDraftAndLevels(null); setError(null); }}><RotateCcw className="h-4 w-4" /> Another file</button>
        </div>
      </div>
      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {draft?.notes.map((t, i) => <Alert key={i} kind="info">{t}</Alert>)}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* left: original or live preview */}
        <section className="min-w-0">
          <div className="mb-2 flex gap-1 border-b border-ink-line">
            <button className={clsx("tab", view === "original" && "tab-active")} onClick={() => setView("original")}>Your sample</button>
            <button className={clsx("tab", view === "preview" && "tab-active")} onClick={() => setView("preview")} disabled={!draft}>Preview of the new form</button>
          </div>
          <div className="max-h-[78vh] overflow-auto rounded-xl border border-ink-line bg-white p-2">
            {view === "original" ? (
              sample.kind === "excel" ? (
                <table className="w-full border-collapse text-xs">
                  <tbody>{(sample.rows ?? []).slice(0, 80).map((r, i) => (
                    <tr key={i}>{(r as unknown[]).map((c, j) => <td key={j} className="border border-ink-line/70 px-1.5 py-1 align-top">{c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? "")}</td>)}</tr>))}</tbody>
                </table>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <div className="space-y-2">{sample.previews.map((p, i) => <img key={i} src={p} alt={`Page ${i + 1}`} className="w-full rounded border border-ink-line" />)}</div>
              )
            ) : draft && (
              <div className="rounded-lg bg-ink-wash p-3">
                <FormRenderer title={draft.title} description={draft.description} schema={draft.fields} preview propertyName={propertyName} propertyLogo={propertyLogo}
                  theme={{ primary: "#2563EB", logoSource: "property", showPropertyName: true, formCode: draft.formCode }} />
              </div>
            )}
          </div>
        </section>

        {/* right: the editable design */}
        {draft ? (
          <section className="min-w-0 space-y-4">
            <div className="card space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div><label className="label" htmlFor="st">Form name</label><input id="st" className="input font-semibold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                <div><label className="label" htmlFor="sc">Form code</label><input id="sc" className="input font-mono" value={draft.formCode} placeholder="optional" onChange={(e) => setDraft({ ...draft, formCode: e.target.value })} /></div>
              </div>
              <div><label className="label" htmlFor="sd">Instructions</label><textarea id="sd" rows={2} className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            </div>

            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Fields <span className="font-normal text-ink-mute">({draft.fields.filter((f) => f.type !== "heading").length})</span></p>
                <div className="flex gap-1.5">
                  <button className="btn-secondary btn-sm" onClick={() => setF([...draft.fields, { id: newId(), type: "heading", label: "New section" }])}><Heading className="h-3.5 w-3.5" /> Section</button>
                  <button className="btn-secondary btn-sm" onClick={() => setF([...draft.fields, { id: newId(), type: "text", label: "New field" }])}><Plus className="h-3.5 w-3.5" /> Field</button>
                </div></div>
              {draft.fields.length === 0 && <p className="py-6 text-center text-sm text-ink-mute">No fields found. Add them here, or try {aiEnabled ? "AI design" : "another file"}.</p>}
              <ul className="space-y-1.5">
                {draft.fields.map((f, i) => (
                  <li key={f.id} className={clsx("rounded-lg border p-2", f.type === "heading" ? "border-brand-200 bg-brand-50/50" : "border-ink-line")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input className={clsx("input min-w-[140px] flex-1 py-1.5", f.type === "heading" && "font-semibold text-brand-800")} value={f.label} onChange={(e) => upd(i, { label: e.target.value })} aria-label="Label" />
                      <select className="input w-[120px] py-1.5" value={f.type} aria-label="Type"
                        onChange={(e) => { const t = e.target.value as FieldType; upd(i, { type: t, options: CHOICE_TYPES.includes(t) ? f.options ?? [] : undefined }); }}>
                        {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
                      {f.type !== "heading" && <label className="flex items-center gap-1 text-xs text-ink-soft"><input type="checkbox" checked={!!f.required} onChange={(e) => upd(i, { required: e.target.checked })} /> Req.</label>}
                      <button className="p-1 text-ink-mute hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button className="p-1 text-ink-mute hover:text-ink disabled:opacity-30" disabled={i === draft.fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                      <button className="p-1 text-ink-mute hover:text-red-600" onClick={() => setF(draft.fields.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {CHOICE_TYPES.includes(f.type) && (
                      <input className="input mt-1.5 py-1.5 text-xs" placeholder="Options, separated by commas" value={(f.options ?? []).join(", ")}
                        onChange={(e) => upd(i, { options: e.target.value.split(",").map((s) => s.trimStart()) })} aria-label="Options" />)}
                    {f.type === "file" && <label className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft"><input type="checkbox" checked={!!f.multiple} onChange={(e) => upd(i, { multiple: e.target.checked, maxFiles: e.target.checked ? 5 : undefined })} /> Allow several files</label>}
                  </li>))}
              </ul>
            </div>

            <div className="card space-y-3 p-4">
              <p className="font-semibold">Who can fill it in?</p>
              <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} aria-label="Who can fill it in">
                <option value="assigned">Only the people and groups I choose</option>
                <option value="all_users">All users of {propertyName}</option>
                <option value="public">Anyone with the link or QR code (no login)</option>
              </select>
              {visibility === "assigned" && (
                <Picker selected={fillers} onChange={setFillers} placeholder="Add people or groups who can submit it…"
                  options={[...groups.map((g) => ({ key: `g:${g.id}`, label: g.name, sub: `Group · ${g.members} members`, kind: "group" as const })),
                    ...users.map((u) => ({ key: `u:${u.id}`, label: u.name, sub: [u.username, u.department].filter(Boolean).join(" · "), kind: "user" as const }))]} />)}
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-semibold">Approval levels &amp; approvers</p>
                <p className="text-sm text-ink-mute">{draft.steps.length ? "Suggested from the sign-off part of your sample — pick who approves each level." : "None found in the sample — add levels if the form needs approval."} Approvers get Review access automatically.</p>
              </div>
              <LevelsEditor steps={levels} setSteps={setLevels} options={approverOptions(users, groups, [])} />
            </div>

            <div className="card flex flex-wrap items-center gap-3 p-4">
              <button className="btn-primary px-5 py-2.5" disabled={creating} onClick={() => create(true)}><Send className="h-4 w-4" /> {creating ? "Saving…" : "Save & publish"}</button>
              <button className="btn-secondary py-2.5" disabled={creating} onClick={() => create(false)}><Save className="h-4 w-4" /> Save as draft</button>
              <p className="w-full text-xs text-ink-mute">Saved to your Forms list — you can open and change it any time; edits save automatically. Publishing opens the share options (link, QR code, WhatsApp).</p>
            </div>
          </section>
        ) : !busy && (
          <section className="card flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Upload className="h-8 w-8 text-ink-mute" />
            <p className="text-sm text-ink-mute">No design yet.</p>
            {aiEnabled && <button className="btn-primary" onClick={() => runAi(sample)}><Sparkles className="h-4 w-4" /> Design with AI</button>}
          </section>
        )}
      </div>
    </div>
  );
}
