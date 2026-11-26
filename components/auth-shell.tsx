import { Logo } from "./ui";
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(1200px_600px_at_80%_-10%,#DBE8FE_0%,transparent_60%),radial-gradient(800px_500px_at_-10%_110%,#E0F7FB_0%,transparent_60%)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo className="h-9" /></div>
        <div className="card p-6 sm:p-7">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-mute">Velkomo Signa · Forms & approvals</p>
      </div>
    </main>
  );
}
