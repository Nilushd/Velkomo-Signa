import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { rootSql } from "@/lib/db";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  if (await getSession()) redirect("/");
  const { next, expired } = await searchParams;
  const saved = (await cookies()).get("signa_property")?.value ?? "";
  const [prop] = saved.toUpperCase() === "PLATFORM" ? [{ code: "PLATFORM", name: "Velkomo Signa Platform" }] : saved ? await rootSql()<{ code: string; name: string }[]>`select property_code as code, name from properties where lower(property_code) = lower(${saved}) and active` : [];
  return (
    <AuthShell title="Sign in" subtitle={prop ? `Welcome back to ${prop.name}.` : "Use the property code from your admin."}>
      {expired && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Your sign-in timed out. Please sign in again.</p>}
      <LoginForm next={next ?? ""} saved={prop ? { code: prop.code, name: prop.name } : null} />
    </AuthShell>
  );
}
