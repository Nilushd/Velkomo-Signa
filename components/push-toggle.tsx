"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

function urlB64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Turns on Web Push for this device (needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and the service worker). */
export function PushToggle({ explain = false }: { explain?: boolean }) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<"unsupported" | "off" | "on" | "busy" | "denied">("off");
  useEffect(() => {
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => s && setState("on")).catch(() => {});
  }, [key]);
  if (state === "unsupported") return explain ? <span className="text-xs text-ink-mute">{key ? "Not supported in this browser" : "Not set up on this server yet"}</span> : null;
  async function enable() {
    setState("busy");
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key!) });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      setState("on");
    } catch { setState("off"); }
  }
  if (state === "on") return <span className="btn-secondary pointer-events-none"><BellRing className="h-4 w-4 text-brand-600" /> Push on</span>;
  if (state === "denied") return <span className="text-xs text-ink-mute">Push blocked in browser settings</span>;
  return <button onClick={enable} className="btn-secondary" disabled={state === "busy"}><BellRing className="h-4 w-4" /> Enable push</button>;
}
