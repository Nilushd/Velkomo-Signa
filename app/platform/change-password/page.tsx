import { requirePlatformAdmin } from "@/lib/platform-auth";
import { AuthShell } from "@/components/auth-shell";
import { PlatformPasswordForm } from "../(console)/account/password";

export const metadata = { title: "Choose a password" };

export default async function PlatformFirstPassword() {
  const a = await requirePlatformAdmin({ allowMustChange: true });
  return (
    <AuthShell title="Choose your password" subtitle={`Welcome, ${a.name.split(" ")[0]}. Replace the temporary password before using the Platform.`}>
      <PlatformPasswordForm first />
    </AuthShell>
  );
}
