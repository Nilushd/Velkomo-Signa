import { redirect } from "next/navigation";
import { rootSql } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { PublicShell } from "@/components/public-shell";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Logo } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Verify a document" };

const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{5})(.{5})$/, "$1-$2");

async function lookup(fd: FormData) {
  "use server";
  if (!(await rateLimit(`verify:${await clientIp()}`, 30, 600))) redirect("/verify?e=limit");
  const doc = String(fd.get("doc") ?? "").trim().toUpperCase();
  const code = normCode(String(fd.get("code") ?? ""));
  const [s] = await rootSql()<{ verify_code: string }[]>`select verify_code from submissions where upper(ref_no) = ${doc} and verify_code = ${code}`;
  redirect(s ? `/v/${s.verify_code}?doc=${encodeURIComponent(doc)}` : `/verify?e=notfound&doc=${encodeURIComponent(doc)}`);
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ e?: string; doc?: string }> }) {
  const sp = await searchParams;
  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center"><Logo className="h-8" /></div>
        <form action={lookup} className="card space-y-4 p-6">
          <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-brand-600" /><h1 className="text-xl font-bold">Verify a document</h1></div>
          <p className="text-sm text-ink-soft">Enter the document number and verification code printed at the top of the form (or simply scan its QR code).</p>
          {sp.e === "notfound" && <Alert kind="error">No document matches that number and code. Check both and try again — a mismatch may mean the copy isn&apos;t genuine.</Alert>}
          {sp.e === "limit" && <Alert kind="error">Too many attempts. Please wait a few minutes.</Alert>}
          <div><label className="label" htmlFor="doc">Document number</label><input id="doc" name="doc" className="input font-mono uppercase" defaultValue={sp.doc ?? ""} placeholder="REQ-2026-0001" required /></div>
          <div><label className="label" htmlFor="code">Verification code</label><input id="code" name="code" className="input font-mono uppercase" placeholder="XXXXX-XXXXX" required autoComplete="off" /></div>
          <SubmitButton className="btn-primary w-full">Verify</SubmitButton>
        </form>
      </div>
    </PublicShell>
  );
}
