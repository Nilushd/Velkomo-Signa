"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, asUser, hashPassword, passwordProblem } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { pruneApprovers } from "./forms";
import type { FormState } from "./auth";

const userSchema = z.object({
  username: z.string().trim().min(2, "Username is too short").max(40).regex(/^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dot, dash and underscore"),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid e-mail").or(z.literal("")).optional(),
  department: z.string().trim().max(120).optional(),
});

const LEVELS = ["general", "review", "approve"] as const;

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const pw = String(fd.get("password") ?? "");
  const prob = passwordProblem(pw);
  if (prob) return { error: `Temporary password: ${prob}` };
  const designer = fd.get("can_build_forms") === "on";
  // form access chosen on the Add user page: fields named access_<formId>
  const access = [...fd.entries()].filter(([k, v]) => k.startsWith("access_") && (LEVELS as readonly string[]).includes(String(v)))
    .map(([k, v]) => ({ formId: k.slice(7), level: String(v) })).filter((x) => /^[0-9a-f-]{36}$/.test(x.formId));
  let id: string;
  try {
    id = await asUser(admin, async (tx) => {
      const [u] = await tx<{ id: string }[]>`insert into users (property_id, username, name, email, department, password_hash, is_admin, can_build_forms, can_use_studio, can_use_ai, must_change_password)
        values (${admin.property_id}, ${p.data.username}, ${p.data.name}, ${p.data.email || null}, ${p.data.department || null}, ${await hashPassword(pw)},
          ${fd.get("is_admin") === "on"}, ${designer}, ${designer}, ${designer}, true) returning id`;
      for (const a of access)
        await tx`insert into form_access (property_id, form_id, user_id, access) select ${admin.property_id}, id, ${u.id}, ${a.level} from forms where id = ${a.formId}`;
      return u.id;
    });
  } catch (e) {
    if (String(e).includes("users_username_uq")) return { error: "That username is already used in this property." };
    throw e;
  }
  redirect(`/users/${id}?created=1`);
}

export async function updateUser(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await asUser(admin, (tx) => tx`update users set username = ${p.data.username}, name = ${p.data.name}, email = ${p.data.email || null},
      department = ${p.data.department || null} where id = ${userId}`);
  } catch (e) {
    if (String(e).includes("users_username_uq")) return { error: "That username is already used in this property." };
    throw e;
  }
  revalidatePath(`/users/${userId}`);
  return { ok: "Saved." };
}

/**
 * User permissions that apply to the whole property (saved immediately):
 *  admin    — manage users, see every form and submission
 *  designer — create and edit forms, including Form Studio and AI design
 */
export async function setRole(userId: string, role: "admin" | "designer", on: boolean) {
  const admin = await requireAdmin();
  if (role === "admin" && userId === admin.id && !on) return { error: "You can't remove your own admin rights." };
  await asUser(admin, (tx) => role === "admin"
    ? tx`update users set is_admin = ${on} where id = ${userId}`
    : tx`update users set can_build_forms = ${on}, can_use_studio = ${on}, can_use_ai = ${on} where id = ${userId}`);
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { ok: true };
}

export async function setActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) return;
  await asUser(admin, (tx) => tx`update users set active = ${active} where id = ${userId}`);
  if (!active) await rootSql()`delete from sessions where user_id = ${userId}`;
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
}

export async function resetPassword(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const pw = String(fd.get("password") ?? "");
  const prob = passwordProblem(pw);
  if (prob) return { error: prob };
  const hash = await hashPassword(pw);
  const n = await asUser(admin, (tx) => tx`update users set password_hash = ${hash}, must_change_password = true, failed_logins = 0, locked_until = null where id = ${userId}`);
  if (n.count === 0) return { error: "User not found." };
  await rootSql()`delete from sessions where user_id = ${userId}`;
  return { ok: "Password reset. The user must change it at next sign-in." };
}

export async function unlockUser(userId: string) {
  const admin = await requireAdmin();
  await asUser(admin, (tx) => tx`update users set failed_logins = 0, locked_until = null where id = ${userId}`);
  revalidatePath(`/users/${userId}`);
}

/** Per-user form access from the user's page: one dropdown per form. */
export async function setUserFormAccess(userId: string, formId: string, access: "none" | "general" | "review" | "approve") {
  const admin = await requireAdmin();
  if (!["none", "general", "review", "approve"].includes(access)) return { ok: false, removed: [] as string[] };
  const removed = await asUser(admin, async (tx) => {
    await tx`delete from form_access where form_id = ${formId} and user_id = ${userId}`;
    if (access !== "none") await tx`insert into form_access (property_id, form_id, user_id, access) values (${admin.property_id}, ${formId}, ${userId}, ${access})`;
    return pruneApprovers(tx, formId);
  });
  revalidatePath(`/users/${userId}`);
  return { ok: true, removed };
}

/** Give one user the same access level on every form (the "Apply to all forms" shortcut). */
export async function setUserAccessAllForms(userId: string, access: "none" | "general" | "review" | "approve") {
  const admin = await requireAdmin();
  if (!["none", "general", "review", "approve"].includes(access)) return { ok: false, removed: [] as string[] };
  const removed = await asUser(admin, async (tx) => {
    await tx`delete from form_access where user_id = ${userId}`;
    if (access !== "none") await tx`insert into form_access (property_id, form_id, user_id, access) select ${admin.property_id}, id, ${userId}, ${access} from forms`;
    const out: string[] = [];
    for (const f of await tx<{ id: string }[]>`select id from forms`) out.push(...(await pruneApprovers(tx, f.id)));
    return [...new Set(out)];
  });
  revalidatePath(`/users/${userId}`);
  return { ok: true, removed };
}

export async function setUserGroups(userId: string, groupIds: string[]) {
  const admin = await requireAdmin();
  await asUser(admin, async (tx) => {
    await tx`delete from group_members where user_id = ${userId}`;
    for (const g of groupIds) await tx`insert into group_members (property_id, group_id, user_id) values (${admin.property_id}, ${g}, ${userId})`;
  });
  revalidatePath(`/users/${userId}`);
}

export async function createGroup(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Group name is required." };
  try {
    await asUser(admin, (tx) => tx`insert into groups (property_id, name) values (${admin.property_id}, ${name})`);
  } catch { return { error: "A group with that name already exists." }; }
  revalidatePath("/users/groups");
  return { ok: `Group “${name}” created.` };
}

export async function saveGroupMembers(groupId: string, userIds: string[]) {
  const admin = await requireAdmin();
  const ids = z.array(z.string().uuid()).parse(userIds);
  await asUser(admin, async (tx) => {
    await tx`delete from group_members where group_id = ${groupId}`;
    for (const u of ids) await tx`insert into group_members (property_id, group_id, user_id) values (${admin.property_id}, ${groupId}, ${u})`;
    const forms = await tx<{ form_id: string }[]>`select distinct form_id from form_access where group_id = ${groupId}`;
    for (const f of forms) await pruneApprovers(tx, f.form_id);
  });
  revalidatePath("/users/groups");
  return { ok: true };
}

export async function renameGroup(groupId: string, name: string) {
  const admin = await requireAdmin();
  await asUser(admin, (tx) => tx`update groups set name = ${name.trim().slice(0, 120)} where id = ${groupId}`);
  revalidatePath("/users/groups");
}

export async function deleteGroup(groupId: string) {
  const admin = await requireAdmin();
  await asUser(admin, (tx) => tx`delete from groups where id = ${groupId}`);
  revalidatePath("/users/groups");
}
