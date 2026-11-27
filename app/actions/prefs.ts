"use server";
import { revalidatePath } from "next/cache";
import { requireUser, asUser } from "@/lib/auth";

/** My notification preference: also get approval requests and reminders by e-mail (off = app only). */
export async function setEmailApprovals(on: boolean) {
  const u = await requireUser();
  await asUser(u, (tx) => tx`update users set email_approvals = ${on} where id = ${u.id}`);
  revalidatePath("/settings");
  return { ok: true };
}
