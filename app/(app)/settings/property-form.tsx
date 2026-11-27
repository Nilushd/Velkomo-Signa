"use client";
import { useActionState, useState } from "react";
import { updateProperty } from "@/app/actions/property";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { uploadFile } from "@/lib/upload-client";

export function PropertyForm({ name, logo, code }: { name: string; logo: string | null; code: string }) {
  const [state, run] = useActionState(updateProperty, undefined);
  const [logoId, setLogoId] = useState(logo ?? "");
  const [err, setErr] = useState<string | null>(null);
  async function upload(file: File) {
    setErr(null);
    try { const j = await uploadFile(file, { purpose: "logo" }); setLogoId(j.fileId); }
    catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
  }
  return (
    <form action={run} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <input type="hidden" name="logo" value={logoId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="pname">Property name</label><input id="pname" name="name" className="input" defaultValue={name} required /></div>
        <div><label className="label">Property code</label><input className="input" value={code} disabled /><p className="help">Only the Super Admin can change codes.</p></div>
      </div>
      <div>
        <p className="label">Logo</p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoId ? <img src={`/api/files/${logoId}`} alt="" className="h-14 w-14 rounded-lg border border-ink-line object-contain p-1" /> : <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-ink-line text-xs text-ink-mute">None</div>}
          <label className="btn-secondary btn-sm cursor-pointer">Upload<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          {logoId && <button type="button" className="btn-ghost btn-sm" onClick={() => setLogoId("")}>Remove</button>}
        </div>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
      <SubmitButton>Save property</SubmitButton>
    </form>
  );
}
