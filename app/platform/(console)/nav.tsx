"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Hotel, ShieldUser, UserCog, LogOut, Menu, X } from "lucide-react";
import { platformLogoutAction } from "@/app/actions/platform-auth";

const NAV = [
  { href: "/platform", label: "Hotels", icon: Hotel, match: (p: string) => p === "/platform" || p.startsWith("/platform/new") },
  { href: "/platform/admins", label: "Super Admins", icon: ShieldUser, match: (p: string) => p.startsWith("/platform/admins") },
  { href: "/platform/account", label: "My account", icon: UserCog, match: (p: string) => p.startsWith("/platform/account") },
];

export function PlatformNav({ name, username }: { name: string; username: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const body = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/velkomo-signa-logo-horizontal-white.svg" alt="Velkomo Signa" className="h-7 w-auto" />
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cyan-400/15 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">Platform console</span>
      </div>
      <nav className="mt-6 flex-1 space-y-1 px-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition", n.match(path) ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white")}>
            <n.icon className="h-[18px] w-[18px]" /> {n.label}</Link>))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-slate-400">@{username} · Super Admin</p>
        <form action={platformLogoutAction}><button className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></form>
      </div>
    </div>
  );
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-950 px-4 py-3 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/velkomo-signa-logo-horizontal-white.svg" alt="Velkomo Signa" className="h-6 w-auto" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Platform</span>
        <button onClick={() => setOpen(true)} aria-label="Menu" className="text-white"><Menu className="h-6 w-6" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-white" aria-label="Close"><X className="h-6 w-6" /></button>{body}</aside>
        </div>)}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-slate-950 lg:block">{body}</aside>
    </>
  );
}
