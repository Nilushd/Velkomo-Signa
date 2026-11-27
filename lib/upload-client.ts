"use client";
/**
 * Upload one file from the browser. With object storage (Vercel + Supabase Storage) the bytes go straight to
 * storage through a one-time signed URL; otherwise they're posted to the app. Returns the stored file's reference.
 */
export async function uploadFile(file: File, target: { code: string } | { purpose: "logo" }): Promise<{ fileId: string; name: string; size: number }> {
  const start = await fetch("/api/upload/start", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, name: file.name, size: file.size, type: file.type }) });
  const s = await start.json().catch(() => ({}));
  if (!start.ok) throw new Error(s.error || "Upload failed");
  if (s.direct) {
    const put = await fetch(s.uploadUrl, { method: "PUT", body: file, headers: { "content-type": s.contentType || file.type || "application/octet-stream", "x-upsert": "false", "cache-control": "max-age=3600" } });
    if (!put.ok) throw new Error("Upload failed. Please check your connection and try again.");
    const fin = await fetch("/api/upload/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: s.fileId }) });
    const f = await fin.json().catch(() => ({}));
    if (!fin.ok) throw new Error(f.error || "Upload failed");
    return f;
  }
  const fd = new FormData();
  fd.append("file", file);
  if ("code" in target) fd.append("code", target.code); else fd.append("purpose", target.purpose);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Upload failed");
  return j;
}
