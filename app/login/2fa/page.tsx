import { redirect } from "next/navigation";
import { pendingTwoFactor } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { TwoFactorForm } from "./form";

export const metadata = { title: "Enter your code" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const p = await pendingTwoFactor();
  if (!p) redirect("/login?expired=1");
  const { next } = await searchParams;
  return (
    <AuthShell title="Two-step sign-in" subtitle={`Hi ${p.name.split(" ")[0]} — open your authenticator app and enter the 6-digit code for Velkomo Signa.`}>
      <TwoFactorForm next={next ?? "/"} />
    </AuthShell>
  );
}
