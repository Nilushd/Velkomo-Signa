"use client";
import { useState } from "react";
import clsx from "clsx";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Copy, Type, AlignLeft, Hash, Calendar, ChevronDownSquare, CircleDot, CheckSquare, AtSign, Phone, Paperclip, PenLine, Heading } from "lucide-react";
import { FIELD_TYPES, CHOICE_TYPES, type Field, type FieldType } from "@/lib/types";

const ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type, textarea: AlignLeft, number: Hash, date: Calendar, select: ChevronDownSquare, radio: CircleDot, checkbox: CheckSquare,
  email: AtSign, phone: Phone, file: Paperclip, signature: PenLine, heading: Heading,
};
const label = (t: FieldType) => FIELD_TYPES.find((f) => f.type === t)!.label;
const newId = () => "f_" + Math.random().toString(36).slice(2, 9);

function Row({ f, selected, onSelect, onDelete, onCopy }: { f: Field; selected: boolean; onSelect: () => void; onDelete: () => void; onCopy: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const Icon = ICONS[f.type];
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("group flex items-center gap-2 rounded-lg border bg-white px-2 py-2.5 shadow-sm", selected ? "border-brand-500 ring-2 ring-brand-100" : "border-ink-line hover:border-brand-300", isDragging && "z-10 opacity-80 shadow-lg")}>
      <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-ink-mute hover:text-ink" aria-label="Drag to reorder"><GripVertical className="h-4 w-4" /></button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Icon className="h-4 w-4 shrink-0 text-brand-600" />
        <span className={clsx("truncate text-sm", f.type === "heading" ? "font-semibold" : "font-medium")}>{f.label || <em className="text-ink-mute">Untitled</em>}</span>
        {f.required && <span className="text-red-600">*</span>}
        <span className="ml-auto shrink-0 text-xs text-ink-mute">{label(f.type)}</span>
      </button>
      <button onClick={onCopy} className="p-1 text-ink-mute opacity-0 hover:text-ink group-hover:opacity-100" aria-label="Duplicate"><Copy className="h-4 w-4" /></button>
      <button onClick={onDelete} className="p-1 text-ink-mute opacity-0 hover:text-red-600 group-hover:opacity-100" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

export function FieldsTab({ schema, setSchema, description, setDescription }: { schema: Field[]; setSchema: (f: Field[]) => void; description: string; setDescription: (s: string) => void }) {
  const [sel, setSel] = useState<string | null>(schema[0]?.id ?? null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const current = schema.find((f) => f.id === sel) ?? null;

  function add(type: FieldType, preset?: Partial<Field>) {
    const f: Field = { id: newId(), type, label: type === "heading" ? "New section" : label(type), required: false, ...preset };
    if (CHOICE_TYPES.includes(type)) f.options = ["Option 1", "Option 2"];
    const i = current ? schema.findIndex((x) => x.id === current.id) + 1 : schema.length;
    setSchema([...schema.slice(0, i), f, ...schema.slice(i)]);
    setSel(f.id);
  }
  function update(p: Partial<Field>) { setSchema(schema.map((f) => (f.id === sel ? { ...f, ...p } : f))); }
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const a = schema.findIndex((f) => f.id === e.active.id), b = schema.findIndex((f) => f.id === e.over!.id);
    setSchema(arrayMove(schema, a, b));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_1fr_300px]">
      <aside>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">Add a field</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {FIELD_TYPES.map((t) => { const Icon = ICONS[t.type]; return (
            <button key={t.type} onClick={() => add(t.type)} className="flex items-center gap-2 rounded-lg border border-ink-line bg-white px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50">
              <Icon className="h-4 w-4 text-brand-600" /> {t.label}</button>); })}
          <button onClick={() => add("file", { label: "Attachments", multiple: true, maxFiles: 5, help: "Add supporting documents, e.g. quotes, invoices or photos." })}
            className="col-span-2 flex items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2 text-left text-sm font-medium text-brand-800 hover:bg-brand-50 lg:col-span-1">
            <Paperclip className="h-4 w-4" /> Attachments section</button>
        </div>
      </aside>
      <section>
        <div className="card mb-3 p-3">
          <label className="label" htmlFor="desc">Description (shown under the title)</label>
          <textarea id="desc" rows={2} className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell people what this form is for." />
        </div>
        {schema.length === 0 ? (
          <div className="card border-2 border-dashed px-6 py-14 text-center text-sm text-ink-mute">Click a field type on the left to add your first field.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={schema.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {schema.map((f) => <Row key={f.id} f={f} selected={f.id === sel} onSelect={() => setSel(f.id)}
                  onDelete={() => { setSchema(schema.filter((x) => x.id !== f.id)); if (sel === f.id) setSel(null); }}
                  onCopy={() => { const c = { ...f, id: newId(), label: f.label + " (copy)" }; const i = schema.indexOf(f) + 1; setSchema([...schema.slice(0, i), c, ...schema.slice(i)]); setSel(c.id); }} />)}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
      <aside className="card h-fit p-4 lg:sticky lg:top-6">
        {!current ? <p className="text-sm text-ink-mute">Select a field to edit its settings.</p> : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{label(current.type)} settings</p>
            <div><label className="label" htmlFor="fl">{current.type === "heading" ? "Heading text" : "Label"}</label>
              <input id="fl" className="input" value={current.label} onChange={(e) => update({ label: e.target.value })} /></div>
            {current.type !== "heading" && <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!current.required} onChange={(e) => update({ required: e.target.checked })} /> Required</label>
              {!["checkbox", "radio", "file", "signature"].includes(current.type) &&
                <div><label className="label" htmlFor="fp">Placeholder</label><input id="fp" className="input" value={current.placeholder ?? ""} onChange={(e) => update({ placeholder: e.target.value })} /></div>}
            </>}
            <div><label className="label" htmlFor="fh">Help text</label><input id="fh" className="input" value={current.help ?? ""} onChange={(e) => update({ help: e.target.value })} /></div>
            {current.type === "file" && (
              <div className="space-y-2 rounded-lg bg-ink-wash/60 p-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!current.multiple} onChange={(e) => update({ multiple: e.target.checked, maxFiles: e.target.checked ? current.maxFiles ?? 5 : undefined })} /> Allow several files</label>
                {current.multiple && <div><label className="label" htmlFor="fm">Maximum files</label>
                  <select id="fm" className="input" value={current.maxFiles ?? 5} onChange={(e) => update({ maxFiles: Number(e.target.value) })}>
                    {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>}
                <p className="help">PDF, images, Word, Excel or CSV · max 10 MB each.</p>
              </div>)}
            {CHOICE_TYPES.includes(current.type) && (
              <div><label className="label" htmlFor="fo">Options (one per line)</label>
                <textarea id="fo" rows={6} className="input font-mono text-xs" value={(current.options ?? []).join("\n")}
                  onChange={(e) => update({ options: e.target.value.split("\n") })} onBlur={(e) => update({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
                {current.type === "checkbox" && <p className="help">Leave empty for a single yes/no tick box.</p>}
              </div>)}
            <div><label className="label" htmlFor="ft">Field type</label>
              <select id="ft" className="input" value={current.type} onChange={(e) => { const t = e.target.value as FieldType; update({ type: t, options: CHOICE_TYPES.includes(t) ? current.options ?? ["Option 1"] : undefined }); }}>
                {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select></div>
          </div>
        )}
      </aside>
    </div>
  );
}
