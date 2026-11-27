/**
 * Where uploaded file bytes live.
 *  - Supabase Storage (production on Vercel): set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Browsers upload straight
 *    to storage with a one-time signed URL (no 4.5 MB Vercel body limit, no bytes through the app), and downloads are
 *    short-lived signed links. The database only keeps the file's metadata.
 *  - Database (local development fallback): bytes in files.data.
 */
import { StorageClient } from "@supabase/storage-js";

const BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET || "signa-files";
export const usesObjectStorage = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let client: StorageClient | null = null;
function store() {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    client = new StorageClient(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });
  }
  return client.from(BUCKET());
}

/** Object key: one folder per property and form, a random id, and a safe version of the name. */
export function makeKey(propertyId: string, folder: string, fileId: string, name: string) {
  const safe = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
  return `${propertyId}/${folder}/${fileId}-${safe}`;
}

export async function signedUpload(key: string): Promise<{ url: string }> {
  const { data, error } = await store().createSignedUploadUrl(key);
  if (error || !data) throw new Error(`storage: ${error?.message ?? "no upload url"}`);
  return { url: data.signedUrl };
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string) {
  const { error } = await store().upload(key, bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`storage: ${error.message}`);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  const { data, error } = await store().download(key);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** A link valid for `seconds`; with `downloadName` the browser saves it instead of showing it. */
export async function signedDownload(key: string, seconds = 60, downloadName?: string): Promise<string> {
  const { data, error } = await store().createSignedUrl(key, seconds, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new Error(`storage: ${error?.message ?? "no download url"}`);
  return data.signedUrl;
}

export async function removeObjects(keys: string[]) {
  if (!keys.length || !usesObjectStorage()) return;
  const { error } = await store().remove(keys);
  if (error) console.error("[storage] remove failed", error.message);
}
