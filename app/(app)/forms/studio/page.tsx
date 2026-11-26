import { requireBuilder } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Studio } from "@/components/studio/studio";

export const metadata = { title: "Form Studio" };
export const maxDuration = 60; // AI design can take a little while

export default async function StudioPage() {
  const u = await requireBuilder();
  return (
    <>
      <PageHeader title="Form Studio" subtitle="Start from a sample — an Excel sheet, a PDF, or a photo of your paper form — and the system designs the digital form for you to check." />
      <Studio aiEnabled={!!process.env.ANTHROPIC_API_KEY} propertyName={u.property_name} propertyLogo={u.property_logo} />
    </>
  );
}
