import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  if (await getSession()) redirect("/");
  const { next, expired } = await searchParams;
  return (
    <AuthShell title="Sign in" subtitle="Use the property code from your admin.">
      {expired && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Your sign-in timed out. Please sign in again.</p>}
      <LoginForm next={next ?? ""} />
    </AuthShell>
  );
}
