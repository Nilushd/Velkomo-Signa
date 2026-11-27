import { requireAdmin, asUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserForm } from "@/components/user-form";
import { createUser } from "@/app/actions/users";
import { groupOf } from "@/lib/groups";

export const metadata = { title: "Add user" };

export default async function NewUser() {
  const admin = await requireAdmin();
  const forms = await asUser(admin, (tx) => tx<{ id: string; title: string; status: string }[]>`select id, title, status from forms order by title`);
  return (<><PageHeader title="Add user" subtitle="Their details, what they're allowed to do, and which forms they can use." /><div className="card max-w-4xl p-5"><UserForm action={createUser} withPassword forms={forms} group={await groupOf(admin.property_id)} /></div></>);
}
