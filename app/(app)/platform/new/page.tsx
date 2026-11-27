import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewHotelForm } from "./form";

export const metadata = { title: "New hotel" };

export default async function NewHotelPage() {
  const u = await requireUser();
  if (!u.is_super_admin) redirect("/");
  return (
    <>
      <Link href="/platform" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Platform</Link>
      <PageHeader title="New hotel" subtitle="Creates the hotel and its first Admin account. The Admin then adds their own staff and forms." />
      <NewHotelForm />
    </>
  );
}
