"use client";
import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { createForm } from "@/app/actions/forms";
import { fieldsFromRows } from "@/lib/detect";
import { FIELD_TYPES, CHOICE_TYPES, type Field, type FieldType } from "@/lib/types";
import { Alert } from "./ui";

export function ExcelImport() {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File) {
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
      if (!rows.length) throw new Error("The sheet is empty.");
      const f = fieldsFromRows(rows);
      if (!f.length) throw new Error("No column headers found in the first row.");
      setFields(f);
      setTitle(file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }
  const update = (i: number, p: Partial<Field>) => setFields((fs) => fs!.map((f, j) => (j === i ? { ...f, ...p } : f)));

  if (!fields) {
    return (
      <div className="space-y-3">
        {error && <Alert kind="error">{error}</Alert>}
        <label className="card flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed px-6 py-14 text-center hover:border-brand-400">
          <Upload className="h-8 w-8 text-brand-600" />
          <span className="font-semibold">Choose an .xlsx or .csv file</span>
          <span className="text-sm text-ink-mute">It stays in your browser — only the field list is saved.</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card p-4"><label className="label" htmlFor="t">Form name</label><input id="t" className="input max-w-md" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Include</th><th>Field label</th><th>Type</th><th>Required</th><th>Options</th></tr></thead>
          <tbody>{fields.map((f, i) => (
            <tr key={f.id} className={(f as Field & { skip?: boolean }).skip ? "opacity-40" : ""}>
              <td><input type="checkbox" checked={!(f as Field & { skip?: boolean }).skip} onChange={(e) => update(i, { skip: !e.target.checked } as Partial<Field>)} /></td>
              <td><input className="input" value={f.label} onChange={(e) => update(i, { label: e.target.value })} /></td>
              <td><select className="input" value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
                {FIELD_TYPES.filter((t) => t.type !== "heading").map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select></td>
              <td><input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} /></td>
              <td className="min-w-[220px]">{CHOICE_TYPES.includes(f.type) ?
                <input className="input" value={(f.options ?? []).join(", ")} placeholder="Comma separated" onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                : <span className="text-ink-mute">—</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
          const chosen = fields.filter((f) => !(f as Field & { skip?: boolean }).skip).map(({ ...f }) => { delete (f as { skip?: boolean }).skip; return f; });
          const bad = chosen.find((f) => ["select", "radio"].includes(f.type) && !(f.options ?? []).length);
          if (bad) { setError(`“${bad.label}” needs options.`); return; }
          try { await createForm({ title, schema: chosen }); } catch (e) { if (!(e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) setError("Couldn't create the form."); else throw e; }
        })}>{pending ? "Creating…" : `Create form with ${fields.filter((f) => !(f as Field & { skip?: boolean }).skip).length} fields`}</button>
        <button className="btn-ghost" onClick={() => setFields(null)}>Choose another file</button>
      </div>
    </div>
  );
}
