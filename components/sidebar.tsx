"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { LayoutDashboard, FileStack, ClipboardList, Send, Inbox, Table2, Users, Settings, Bell, Menu, X, LogOut, Wand2, ChevronsUpDown, Check, Home } from "lucide-react";
import { switchHotelAction } from "@/app/actions/hotels";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./ui";

interface Props {
  user: { name: string; username: string; isAdmin: boolean; canBuild: boolean; canStudio: boolean; reviewer: boolean };
  property: { name: string; code: string; logo: string | null };
  counts: { approvals: number; unread: number };
  hotels?: { id: string; code: string; name: string; home: boolean; pending: number; current: boolean }[];
}

export function Sidebar({ user, property, counts, hotels = [] }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const cluster = hotels.length > 1;
  const elsewhere = hotels.filter((h) => !h.current).reduce((t, h) => t + h.pending, 0);
  const items = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/forms", label: "Forms", icon: FileStack, show: user.canBuild },
    { href: "/forms/studio", label: "Form Studio", icon: Wand2, show: user.canStudio },
    { href: "/my-forms", label: "My Forms", icon: ClipboardList, show: true },
    { href: "/requests", label: "My Requests", icon: Send, show: true },
    { href: "/approvals", label: "My Approvals", icon: Inbox, show: true, count: counts.approvals },
    { href: "/submissions", label: "Submissions", icon: Table2, show: user.isAdmin || user.reviewer || user.canBuild },
    { href: "/users", label: "Users & Groups", icon: Users, show: user.isAdmin },
    { href: "/notifications", label: "Notifications", icon: Bell, show: true, count: counts.unread },
    { href: "/settings", label: "Settings", icon: Settings, show: true },
  ].filter((i) => i.show);
  const active = (href: string) => (href === "/" ? path === "/" : path === href || (path.startsWith(href + "/") && !(href === "/forms" && path.startsWith("/forms/studio"))));

  const nav = (
    <>
      <div className="relative">
      <button type="button" disabled={!cluster} onClick={() => setPicker(!picker)} aria-expanded={picker} aria-label={cluster ? "Switch hotel" : undefined}
        className={clsx("flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left ring-1 ring-white/10", cluster && "hover:bg-white/10")}>
        {property.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/files/${property.logo}`} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
          : <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">{property.name.slice(0, 1)}</div>}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{property.name}</p>
          <p className="text-xs text-brand-200">{property.code}{cluster ? ` · ${hotels.length} hotels` : ""}</p>
        </div>
        {cluster && <span className="ml-auto flex items-center gap-1">{elsewhere > 0 && <span className="rounded-full bg-tick px-1.5 text-xs font-semibold text-brand-900" title="Waiting for you in other hotels">{elsewhere}</span>}<ChevronsUpDown className="h-4 w-4 text-brand-200" /></span>}
      </button>
      {picker && cluster && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white text-ink shadow-xl ring-1 ring-ink-line" role="menu">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">Switch hotel</p>
          {hotels.map((h) => (
            <form key={h.id} action={switchHotelAction.bind(null, h.id)}>
              <button role="menuitem" className={clsx("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-wash", h.current && "bg-brand-50")}>
                {h.current ? <Check className="h-4 w-4 text-brand-600" /> : h.home ? <Home className="h-4 w-4 text-ink-mute" /> : <span className="w-4" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.name}</span><span className="text-xs text-ink-mute">{h.code}{h.home ? " · your hotel" : ""}</span></span>
                {h.pending > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white" title="Waiting for your approval">{h.pending}</span>}
              </button>
            </form>))}
        </div>)}
      </div>
      <nav className="mt-5 flex-1 space-y-0.5">
        {items.map((i) => (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
            className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active(i.href) ? "bg-white text-brand-900 shadow-sm" : "text-brand-100 hover:bg-white/10 hover:text-white")}>
            <i.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{i.label}</span>
            {!!i.count && <span className={clsx("rounded-full px-1.5 text-xs font-semibold", active(i.href) ? "bg-brand-600 text-white" : "bg-tick text-brand-900")}>{i.count}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-brand-200">@{user.username}{user.isAdmin ? " · Admin" : ""}</p>
        <form action={logoutAction} className="mt-3">
          <button className="flex items-center gap-2 text-sm text-brand-100 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo className="h-7" />
        <div className="flex items-center gap-1">
          <Link href="/approvals" className="btn-ghost relative px-2" aria-label="My approvals">
            <Inbox className="h-5 w-5" />
            {counts.approvals > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{counts.approvals}</span>}
          </Link>
          <button className="btn-ghost px-2" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={clsx("fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-brand-900 bg-[linear-gradient(180deg,#0B1F4D_0%,#0E2A66_100%)] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-5 flex items-center justify-between px-1 pt-1">
          <Logo white className="h-7" />
          <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        {nav}
      </aside>
    </>
  );
}
