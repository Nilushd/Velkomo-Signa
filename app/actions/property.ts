"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser, asUser } from "@/lib/auth";
import type { FormState } from "./auth";

export async function updateProperty(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const logo = String(fd.get("logo") ?? "") || null;
  await asUser(admin, (tx) => tx`update properties set name = ${name.slice(0, 120)}, logo_file_id = ${logo} where id = ${admin.property_id}`);
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
