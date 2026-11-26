import { requireStudio, canAi, asUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Studio } from "@/components/studio/studio";

export const metadata = { title: "Form Studio" };
export const maxDuration = 60; // AI design can take a little while

export default async function StudioPage() {
  const u = await requireStudio();
  const { users, groups } = await asUser(u, async (tx) => ({
    users: await tx<{ id: string; name: string; username: string; department: string | null; email: string | null }[]>`select id, name, username, department, email from users where active order by name`,
    groups: await tx<{ id: string; name: string; members: number }[]>`select g.id, g.name, (select count(*)::int from group_members gm where gm.group_id = g.id) as members from groups g order by g.name`,
  }));
  return (
    <>
      <PageHeader title="Form Studio" subtitle="Start from a sample — an Excel sheet, a PDF, or a photo of your paper form — and the system designs the digital form for you to check." />
      <Studio aiEnabled={canAi(u)} aiConfigured={!!process.env.ANTHROPIC_API_KEY} propertyName={u.property_name} propertyLogo={u.property_logo} users={users} groups={groups} />
    </>
  );
}
