"use server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireStudio, canAi } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { FIELD_TYPES, type Field } from "@/lib/types";
import type { StudioDraft } from "@/lib/studio/parse";

/** AI design is optional: on only when an Anthropic API key is configured. */
export async function aiAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const TYPES = FIELD_TYPES.map((t) => t.type);

// JSON schema for structured output — every property required, no extras.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "formCode", "fields", "approvalLevels"],
  properties: {
    title: { type: "string", description: "Name of the form, e.g. 'Purchase Requisition'" },
    description: { type: "string", description: "Short instructions for the person filling it in; empty if none" },
    formCode: { type: "string", description: "Document-control code printed on the form, e.g. 'HR-F-012 Rev 2'; empty if none" },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "type", "required", "options", "help", "multiple"],
        properties: {
          label: { type: "string" },
          type: { type: "string", enum: TYPES },
          required: { type: "boolean" },
          options: { type: "array", items: { type: "string" }, description: "Choices for select/radio/checkbox; empty otherwise" },
          help: { type: "string", description: "Hint under the field; empty if none" },
          multiple: { type: "boolean", description: "File fields only: true when several documents may be attached" },
        },
      },
    },
    approvalLevels: { type: "array", items: { type: "string" }, description: "Sign-off levels in order, e.g. ['HOD recommendation', 'GM approval']; at most 5" },
  },
} as const;

const Out = z.object({
  title: z.string(), description: z.string(), formCode: z.string(),
  fields: z.array(z.object({ label: z.string(), type: z.enum(TYPES as [string, ...string[]]), required: z.boolean(), options: z.array(z.string()), help: z.string(), multiple: z.boolean() })),
  approvalLevels: z.array(z.string()),
});

const INSTRUCTIONS = `You turn a hotel's existing paper or Excel form into the design of a digital form for a form-and-approval web app.

Read the attached sample form and return its design:
- title, short instructions (description) and any document-control code (formCode) printed on it.
- fields in reading order. Use type "heading" for section titles (label only). Pick the most specific type:
  text, textarea (reasons, remarks, addresses, long answers), number (amounts, quantities, days), date, email, phone,
  select (a dropdown when there are many fixed choices), radio (one choice from a few), checkbox (tick any; with no options it is a single yes/no tick),
  file (attachments the requester must provide; multiple=true when several documents fit), signature (requester's signature).
- Mark required=true only where the form marks a field as required (asterisk, "mandatory") or it is obviously essential (e.g. name, date).
- Sign-off rows such as "Checked by", "Recommended by HOD", "Approved by GM" are approval levels, not fields: put them in approvalLevels in order,
  named after the role and the action (e.g. "HOD recommendation", "GM approval"). Leave out rows for the requester ("Prepared by", "Requested by")
  and "For office use only" boxes that approvers fill in.
- Keep labels short, in the language of the form, without trailing colons, underscores or numbering.
- If something is unreadable, skip it rather than guess.`;

let seq = 0;
function toDraft(o: z.infer<typeof Out>): StudioDraft {
  const fields: Field[] = o.fields.filter((f) => f.label.trim()).slice(0, 150).map((f) => {
    const field: Field = { id: `f_ai${++seq}_${Math.random().toString(36).slice(2, 6)}`, type: f.type as Field["type"], label: f.label.trim().slice(0, 120) };
    if (f.type !== "heading") field.required = f.required;
    if (f.help.trim()) field.help = f.help.trim().slice(0, 300);
    if (["select", "radio", "checkbox"].includes(f.type)) field.options = f.options.map((x) => x.trim()).filter(Boolean).slice(0, 100);
    if ((f.type === "select" || f.type === "radio") && !field.options?.length) field.type = "text";
    if (f.type === "file" && f.multiple) { field.multiple = true; field.maxFiles = 5; }
    return field;
  });
  return { title: o.title.trim() || "Untitled form", description: o.description.trim(), formCode: o.formCode.trim().slice(0, 60), fields,
    steps: o.approvalLevels.map((s) => s.trim()).filter(Boolean).slice(0, 5), notes: ["Designed with AI from your sample — please check every field before creating the form."], source: "ai" };
}

/**
 * Design a form from a sample with Claude. Input is the file as base64 (PDF or image) or, for Excel, the sheet as CSV text.
 */
export async function aiDesign(input: { name: string; mime: string; base64?: string; text?: string }): Promise<{ draft: StudioDraft } | { error: string }> {
  const u = await requireStudio();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "AI design is not set up. Add ANTHROPIC_API_KEY to the server settings." };
  if (!canAi(u)) return { error: "AI design isn't switched on for your account. Ask your admin." };
  if (!(await rateLimit(`ai-design:${u.id}`, 20, 3600))) return { error: "You've used AI design a lot in the last hour. Please try again later." };
  if (input.base64 && input.base64.length > 14_000_000) return { error: "That file is too large for AI design (max 10 MB)." };

  let sample: Anthropic.Beta.BetaContentBlockParam;
  if (input.text) {
    sample = { type: "text", text: `Sample form "${input.name}" exported from Excel as CSV (empty cells are answer spaces):\n\n${input.text.slice(0, 200_000)}` };
  } else if (input.mime === "application/pdf" && input.base64) {
    sample = { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } };
  } else if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(input.mime) && input.base64) {
    sample = { type: "image", source: { type: "base64", media_type: input.mime as "image/png", data: input.base64 } };
  } else return { error: "AI design reads PDF, image (PNG, JPG, WebP) or Excel files." };

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: [sample, { type: "text", text: "Design the digital form for this sample." }] }],
    });
    if (res.stop_reason === "refusal") return { error: "The AI declined to read this file. Try the standard (rules-based) design instead." };
    if (res.stop_reason === "max_tokens") return { error: "This form is too long for AI design in one go. Try a shorter section or the standard design." };
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = Out.safeParse(JSON.parse(text));
    if (!parsed.success) return { error: "The AI's answer couldn't be read. Please try again." };
    return { draft: toDraft(parsed.data) };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { error: "The AI service is busy right now. Please try again in a minute." };
    if (e instanceof Anthropic.AuthenticationError) return { error: "AI design is misconfigured (invalid API key)." };
    if (e instanceof Anthropic.BadRequestError) return { error: "The AI couldn't process this file (it may be too large or unreadable)." };
    if (e instanceof Anthropic.APIError) return { error: `The AI service returned an error (${e.status}). Please try again.` };
    if (e instanceof SyntaxError) return { error: "The AI's answer couldn't be read. Please try again." };
    throw e;
  }
}
