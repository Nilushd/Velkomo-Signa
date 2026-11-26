"use client";
import { useEffect, useRef, useState } from "react";

export type SaveStatus = { s: "idle" | "saving" | "saved" | "blocked" | "error"; text?: string };

/**
 * Save `value` a moment after it stops changing. `check` can block saving (returns the reason);
 * `save` returns an optional message to show (e.g. people who were given access).
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<string | void>, check?: (v: T) => string | null, delay = 800) {
  const [status, setStatus] = useState<SaveStatus>({ s: "idle" });
  const first = useRef(true);
  const key = JSON.stringify(value);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const why = check?.(value);
    if (why) { setStatus({ s: "blocked", text: why }); return; }
    setStatus({ s: "saving" });
    const t = setTimeout(async () => {
      try { const m = await save(value); setStatus({ s: "saved", text: m || undefined }); }
      catch (e) { setStatus({ s: "error", text: e instanceof Error ? e.message : "Couldn't save." }); }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return status;
}

export function SaveLine({ status }: { status: SaveStatus }) {
  const map = {
    idle: ["text-ink-mute", "Changes save automatically."],
    saving: ["text-ink-mute", "Saving…"],
    saved: ["text-emerald-700", status.text ? `Saved. ${status.text}` : "All changes saved."],
    blocked: ["text-amber-800", `Not saved yet — ${status.text}`],
    error: ["text-red-700", `Not saved: ${status.text}`],
  } as const;
  const [cls, text] = map[status.s];
  return <p className={`text-sm ${cls}`} aria-live="polite">{text}</p>;
}
