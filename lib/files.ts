export const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"], gif: ["image/gif"], heic: ["image/heic", "image/heif", ""],
  svg: ["image/svg+xml"],
  doc: ["application/msword"], docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"], xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"], txt: ["text/plain"],
};
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8, jpeg: (b) => b[0] === 0xff && b[1] === 0xd8,
  gif: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  webp: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b, xlsx: (b) => b[0] === 0x50 && b[1] === 0x4b,
};

/** Check extension, declared type and (where we can) the file's magic bytes. Returns the mime to store or an error. */
export function checkFile(name: string, declared: string, bytes: Uint8Array, opts: { imagesOnly?: boolean } = {}): { mime: string } | { error: string } {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const types = ALLOWED[ext];
  if (!types || (opts.imagesOnly && !["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))) return { error: "This file type isn't allowed." };
  if (ext === "svg") return opts.imagesOnly ? { error: "Please use PNG, JPG or WebP for logos." } : { error: "This file type isn't allowed." };
  if (declared && !types.includes(declared) && declared !== "application/octet-stream") return { error: "The file type doesn't match its extension." };
  if (MAGIC[ext] && !MAGIC[ext](bytes)) return { error: "The file content doesn't match its type." };
  return { mime: types[0] || "application/octet-stream" };
}
