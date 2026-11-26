"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser, asUser, hashPassword, passwordProblem } from "@/lib/auth";
import { rootSql } from "@/lib/db";
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

async function requireSuper() {
  const u = await requireUser();
  if (!u.is_super_admin) throw new Error("Super Admin only");
  return u;
}

/** Super Admin: create a property (code, name) and its first Admin. */
export async function createProperty(_: FormState, fd: FormData): Promise<FormState> {
  await requireSuper();
  const p = z.object({
    code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, "Code can use letters, numbers, dash and underscore"),
    name: z.string().trim().min(1, "Name is required").max(120),
    adminUsername: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Invalid admin username"),
    adminName: z.string().trim().min(1, "Admin name is required").max(120),
    adminEmail: z.string().trim().email().or(z.literal("")),
    adminPassword: z.string(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const prob = passwordProblem(p.data.adminPassword);
  if (prob) return { error: `Admin password: ${prob}` };
  const sql = rootSql();
  const [ex] = await sql`select 1 from properties where lower(property_code) = lower(${p.data.code})`;
  if (ex) return { error: "That property code is already used." };
  const hash = await hashPassword(p.data.adminPassword);
  await sql.begin(async (tx) => {
    const [prop] = await tx`insert into properties (property_code, name) values (${p.data.code.toUpperCase()}, ${p.data.name}) returning id`;
    await tx`insert into users (property_id, username, name, email, password_hash, is_admin, can_build_forms, must_change_password)
      values (${prop.id}, ${p.data.adminUsername}, ${p.data.adminName}, ${p.data.adminEmail || null}, ${hash}, true, true, true)`;
  });
  revalidatePath("/super");
  return { ok: `Property ${p.data.code.toUpperCase()} created. ${p.data.adminName} can sign in with the temporary password.` };
}

export async function setPropertyActive(id: string, active: boolean) {
  const u = await requireSuper();
  if (id === u.property_id && !active) return;
  await rootSql()`update properties set active = ${active} where id = ${id}`;
  revalidatePath("/super");
}
