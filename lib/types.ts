export type FieldType =
  | "text" | "textarea" | "number" | "date" | "select" | "radio" | "checkbox"
  | "email" | "phone" | "file" | "signature" | "heading";

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** file fields: allow several files (stored as FileRef[]) */
  multiple?: boolean;
  /** file fields: max number of files when multiple (default 5) */
  maxFiles?: number;
}

export interface Theme {
  primary?: string;
  background?: string;
  font?: "sans" | "serif" | "rounded";
  /** which logo the header shows; older forms only have logoFileId (= custom) */
  logoSource?: "property" | "custom" | "none";
  logoFileId?: string | null;
  logoAlign?: "left" | "center" | "right";
  logoSize?: "s" | "m" | "l";
  /** show the hotel / property name in the header */
  showPropertyName?: boolean;
  /** document control code printed on the form, e.g. "HR-F-012 Rev 2" */
  formCode?: string;
  /** small text printed at the bottom of every printed page, e.g. address or policy note */
  printFooter?: string;
  thankYou?: string;
}

/** Resolve the header logo for a form: the property's logo, the form's own, or none. */
export function headerLogo(theme: Theme, propertyLogo: string | null | undefined): string | null {
  const src = theme.logoSource ?? (theme.logoFileId ? "custom" : "none");
  if (src === "property") return propertyLogo ?? null;
  if (src === "custom") return theme.logoFileId ?? null;
  return null;
}

export const LOGO_HEIGHT = { s: 40, m: 64, l: 96 } as const;

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "select", label: "Dropdown" },
  { type: "radio", label: "Radio" },
  { type: "checkbox", label: "Checkbox" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "file", label: "File upload" },
  { type: "signature", label: "Signature" },
  { type: "heading", label: "Section heading" },
];

export const CHOICE_TYPES: FieldType[] = ["select", "radio", "checkbox"];

export type FormStatus = "draft" | "published" | "closed";
export type Visibility = "public" | "all_users" | "assigned";
export type Channel = "email" | "app" | "both";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface FormRow {
  id: string;
  property_id: string;
  owner_id: string | null;
  title: string;
  description: string;
  short_code: string;
  schema: Field[];
  theme: Theme;
  status: FormStatus;
  visibility: Visibility;
  closes_at: Date | null;
  max_submissions: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubmissionRow {
  id: string;
  property_id: string;
  form_id: string;
  ref_no: string;
  data: Record<string, unknown>;
  submitter_id: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  version: number;
  status: SubmissionStatus;
  current_level: number;
  verify_code: string;
  created_at: Date;
  updated_at: Date;
}

/** value stored for file fields */
export interface FileRef { fileId: string; name: string; size: number }
