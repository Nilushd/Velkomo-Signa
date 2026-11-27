"use client";
import { useEffect, useRef } from "react";

/** Signatures are stored with the answers, so keep them small: at most 600 px wide (≈10–30 KB). */
function compact(src: HTMLCanvasElement) {
  const w = Math.min(600, src.width), h = Math.round(src.height * (w / src.width));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return c.toDataURL("image/png");
}

export function SignaturePad({ value, onChange, disabled, color = "#0F172A" }: { value?: string; onChange: (v: string) => void; disabled?: boolean; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight); img.src = value; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent) { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function down(e: React.PointerEvent) {
    if (disabled) return;
    drawing.current = true; ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(compact(ref.current!));
  }
  function clear() {
    const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange("");
  }
  return (
    <div>
      <canvas ref={ref} className="h-36 w-full touch-none rounded-lg border border-dashed border-ink-line bg-white"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Signature pad" />
      {!disabled && <button type="button" onClick={clear} className="mt-1 text-xs text-ink-mute hover:text-ink">Clear signature</button>}
    </div>
  );
}
