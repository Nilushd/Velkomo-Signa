import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { PageHeader } from "@/components/ui";
import { NewHotelForm } from "./form";
import { timeZoneOptions } from "@/lib/timezones";

export const metadata = { title: "New hotel" };

export default async function NewHotelPage() {
  await requirePlatformAdmin();
  return (
    <>
      <Link href="/platform" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Hotels</Link>
      <PageHeader title="New hotel" subtitle="Creates the hotel and its first Admin account. The Admin then adds their own staff and forms." />
      <NewHotelForm zones={timeZoneOptions()} />
    </>
  );
}
