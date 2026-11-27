import { requirePlatformAdmin } from "@/lib/platform-auth";
import { PlatformNav } from "./nav";

export const metadata = { title: { default: "Platform", template: "%s · Velkomo Signa Platform" } };

/** The Platform module has its own shell — Super Admins never see the hotel app and hotel users never see this. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const a = await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-[#F3F5FA] lg:flex">
      <PlatformNav name={a.name} username={a.username} />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8"><div className="mx-auto max-w-6xl">{children}</div></main>
    </div>
  );
}
