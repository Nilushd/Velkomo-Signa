import { requireBuilder } from "@/lib/auth";
import { createForm } from "@/app/actions/forms";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "New form" };

async function create(fd: FormData) {
  "use server";
  await createForm({ title: String(fd.get("title") ?? "") });
}

export default async function NewForm() {
  await requireBuilder();
  return (
    <>
      <PageHeader title="New form" />
      <form action={create} className="card max-w-lg space-y-4 p-5">
        <div><label className="label" htmlFor="title">Form name</label><input id="title" name="title" className="input" placeholder="e.g. Purchase request" required autoFocus /></div>
        <SubmitButton>Create and open builder</SubmitButton>
      </form>
    </>
  );
}
