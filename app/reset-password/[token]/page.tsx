import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { resetPasswordAction } from "@/app/actions/auth";
export const metadata = { title: "Reset password" };
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AuthShell title="Choose a new password"><PasswordForm action={resetPasswordAction} token={token} /></AuthShell>;
}
