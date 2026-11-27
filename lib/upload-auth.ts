import { getSession } from "./auth";
import { rootSql, tenant } from "./db";
import { formAccess, canSubmit } from "./access";
import type { FormRow } from "./types";

export interface UploadTarget { propertyId: string; formId: string | null; uploadedBy: string | null; isPublic: boolean; imagesOnly: boolean; folder: string }

/** Who may upload where: a logo (form designers/admins) or an attachment to a form the person may submit. */
export async function uploadTarget(input: { purpose?: string | null; code?: string | null }): Promise<UploadTarget | { error: string; status: number }> {
  const user = await getSession();
  if (input.purpose === "logo") {
    if (!user || !(user.is_admin || user.can_build_forms)) return { error: "Not allowed", status: 403 };
    return { propertyId: user.property_id, formId: null, uploadedBy: user.id, isPublic: true, imagesOnly: true, folder: "logos" };
  }
  const [form] = await rootSql()<FormRow[]>`select * from forms where short_code = ${String(input.code ?? "")} and status = 'published'`;
  if (!form) return { error: "Form not found", status: 404 };
  const who = user && user.property_id === form.property_id ? user : null;
  const ok = await tenant({ propertyId: form.property_id, userId: null }, async (tx) => canSubmit(form, who, await formAccess(tx, who, form)));
  if (!ok) return { error: "You don't have access to this form", status: 403 };
  return { propertyId: form.property_id, formId: form.id, uploadedBy: who?.id ?? null, isPublic: false, imagesOnly: false, folder: `forms/${form.id}` };
}
