import { requireBuilder } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ExcelImport } from "@/components/excel-import";

export const metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  await requireBuilder();
  return (
    <>
      <PageHeader title="Import from Excel or CSV" subtitle="The first row becomes the field labels. Types are guessed from the next 20 rows — check them before creating the form." />
      <ExcelImport />
    </>
  );
}
