"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Eye, Save, Send, ArrowLeft } from "lucide-react";
import type { Field, Theme } from "@/lib/types";
import { saveForm, setStatus } from "@/app/actions/forms";
import type { AccessEntry, StepInput } from "@/app/actions/forms";
import { StatusBadge } from "../ui";
import { FieldsTab } from "./fields-tab";
import { ThemeTab } from "./theme-tab";
import { AccessTab } from "./access-tab";
import { ApprovalsTab } from "./approvals-tab";
import { ShareTab } from "./share-tab";
import { FormRenderer } from "../form-renderer";

export interface BuilderData {
  form: { id: string; title: string; description: string; schema: Field[]; theme: Theme; status: string; visibility: string; shortCode: string;
    closesAt: string; maxSubmissions: number | null; ownerId: string | null };
  users: { id: string; name: string; username: string; department: string | null; email: string | null }[];
  groups: { id: string; name: string; members: number }[];
  access: AccessEntry[];
  steps: StepInput[];
  submissionCount: number;
  url: string;
  isAdmin: boolean;
  propertyName: string;
  propertyLogo: string | null;
}

const TABS = ["Fields", "Theme", "Access", "Approvals", "Share & settings"] as const;
type Tab = (typeof TABS)[number];

export function Builder({ data, fromStudio }: { data: BuilderData; fromStudio?: boolean }) {
  const [tab, setTab] = useState<Tab>("Fields");
  const [title, setTitle] = useState(data.form.title);
  const [description, setDescription] = useState(data.form.description);
  const [schema, setSchema] = useState<Field[]>(data.form.schema);
  const [theme, setTheme] = useState<Theme>(data.form.theme);
  const [status, setStat] = useState(data.form.status);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [preview, setPreview] = useState<null | "desktop" | "mobile">(null);
  const [pending, start] = useTransition();

  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  function save(then?: () => Promise<void>) {
    start(async () => {
      const r = await saveForm(data.form.id, { title, description, schema, theme });
      if ("error" in r && r.error) { setMsg({ kind: "err", text: r.error }); return; }
      setDirty(false);
      setMsg({ kind: "ok", text: "Saved." });
      if (then) await then();
    });
  }
  function changeStatus(s: "draft" | "published" | "closed") {
    save(async () => {
      const r = await setStatus(data.form.id, s);
      if ("error" in r && r.error) setMsg({ kind: "err", text: r.error });
      else { setStat(s); setMsg({ kind: "ok", text: s === "published" ? "Published. Share the link or QR code." : s === "closed" ? "Form closed." : "Moved back to draft." }); }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/forms" className="btn-ghost px-2" aria-label="Back to forms"><ArrowLeft className="h-4 w-4" /></Link>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-bold hover:border-ink-line focus:border-brand-500 focus:bg-white focus:outline-none" aria-label="Form title" />
        <StatusBadge status={status} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setPreview("desktop")}><Eye className="h-4 w-4" /> Preview</button>
          <button className="btn-secondary" disabled={pending} onClick={() => save()}><Save className="h-4 w-4" /> {dirty ? "Save draft" : "Saved"}</button>
          {status !== "published"
            ? <button className="btn-primary" disabled={pending} onClick={() => changeStatus("published")}><Send className="h-4 w-4" /> Publish</button>
            : dirty && <button className="btn-primary" disabled={pending} onClick={() => save()}><Send className="h-4 w-4" /> Update live form</button>}
        </div>
      </div>
      {fromStudio && !msg && (
        <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
          <b>Designed from your sample.</b> Check the fields below, then: <button className="font-semibold underline" onClick={() => setTab("Access")}>Access</button> — give people access ·{" "}
          <button className="font-semibold underline" onClick={() => setTab("Approvals")}>Approvals</button> — {data.steps.length ? `pick approvers for the ${data.steps.length} suggested level${data.steps.length > 1 ? "s" : ""}` : "add approval levels if needed"} ·{" "}
          <button className="font-semibold underline" onClick={() => setTab("Theme")}>Theme</button> — logo and colours · then Publish.
        </div>)}
      {msg && <div className={clsx("mb-4 rounded-lg px-3 py-2 text-sm ring-1", msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200")}>{msg.text}</div>}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-line">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={clsx("tab whitespace-nowrap", tab === t && "tab-active")}>{t}</button>)}
      </div>

      {tab === "Fields" && <FieldsTab schema={schema} setSchema={touch(setSchema)} description={description} setDescription={touch(setDescription)} />}
      {tab === "Theme" && <ThemeTab theme={theme} setTheme={touch(setTheme)} title={title} description={description} schema={schema} propertyName={data.propertyName} propertyLogo={data.propertyLogo} />}
      {tab === "Access" && <AccessTab formId={data.form.id} initialVisibility={data.form.visibility} initial={data.access} users={data.users} groups={data.groups} />}
      {tab === "Approvals" && <ApprovalsTab formId={data.form.id} initial={data.steps} users={data.users} groups={data.groups} access={data.access} />}
      {tab === "Share & settings" && <ShareTab data={data} status={status} onStatus={changeStatus} pending={pending} />}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/60 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
            <button className={clsx("btn-sm btn", preview === "desktop" ? "bg-white text-ink" : "text-white")} onClick={() => setPreview("desktop")}>Desktop</button>
            <button className={clsx("btn-sm btn", preview === "mobile" ? "bg-white text-ink" : "text-white")} onClick={() => setPreview("mobile")}>Mobile</button>
            <button className="btn-sm btn text-white" onClick={() => setPreview(null)}>Close</button>
          </div>
          <div className="flex-1 overflow-auto px-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className={clsx("mx-auto rounded-2xl p-4 transition-all", preview === "mobile" ? "max-w-[390px]" : "max-w-3xl")} style={{ background: theme.background || "#F4F7FC" }}>
              <FormRenderer title={title} description={description} schema={schema} theme={theme} preview propertyName={data.propertyName} propertyLogo={data.propertyLogo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
