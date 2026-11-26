import { requireUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { changePasswordAction } from "@/app/actions/auth";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const u = await requireUser({ allowMustChange: true });
  return (
    <AuthShell title="Choose a new password" subtitle={u.must_change_password ? "You signed in with a temporary password. Please choose your own." : "Enter your current password and a new one."}>
      <PasswordForm action={changePasswordAction} withCurrent />
    </AuthShell>
  );
}
