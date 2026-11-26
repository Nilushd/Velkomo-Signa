import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserForm } from "@/components/user-form";
import { createUser } from "@/app/actions/users";

export const metadata = { title: "Add user" };

export default async function NewUser() {
  await requireAdmin();
  return (<><PageHeader title="Add user" subtitle="After creating the user you can give them access to forms." /><div className="card max-w-3xl p-5"><UserForm action={createUser} withPassword /></div></>);
}
