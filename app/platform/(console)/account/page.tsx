import { rootSql } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { PageHeader } from "@/components/ui";
import { TwoFactorPanel } from "@/components/two-factor-panel";
import { PlatformPasswordForm } from "./password";
import { platformStartTwoFactor, platformConfirmTwoFactor, platformDisableTwoFactor, platformNewBackupCodes } from "@/app/actions/platform-auth";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const a = await requirePlatformAdmin();
  const [r] = await rootSql()<{ n: number | null }[]>`select cardinality(recovery_codes) as n from platform_admins where id = ${a.id}`;
  return (
    <>
      <PageHeader title="My account" subtitle={`${a.name} · @${a.username}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Change password</h2><PlatformPasswordForm /></section>
        <section className="card space-y-3 p-5" id="two-factor">
          <div><h2 className="font-semibold">Two-factor authentication</h2><p className="text-sm text-ink-mute">Strongly recommended for Super Admins.</p></div>
          <TwoFactorPanel enabled={a.totp_enabled} backupLeft={a.totp_enabled ? r?.n ?? 0 : null}
            actions={{ start: platformStartTwoFactor, confirm: platformConfirmTwoFactor, disable: platformDisableTwoFactor, newCodes: platformNewBackupCodes }} />
        </section>
      </div>
    </>
  );
}
