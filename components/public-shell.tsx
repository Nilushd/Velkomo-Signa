import Link from "next/link";
export function PublicShell({ background = "#F4F7FC", children }: { background?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-3 py-6 sm:px-4 sm:py-10" style={{ background }}>
      {children}
      <p className="mt-8 text-center text-xs text-ink-mute">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/velkomo-signa-icon.svg" alt="" className="h-4 w-4" /> Powered by Velkomo Signa
        </Link>
      </p>
    </main>
  );
}
export function Notice({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/velkomo-signa-icon.svg" alt="" className="mx-auto mb-4 h-12 w-12" />
      <h1 className="text-xl font-bold">{title}</h1>
      {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
