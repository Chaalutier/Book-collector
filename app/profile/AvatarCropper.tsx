"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 288; // taille de la zone de recadrage à l'écran (px)
const OUTPUT = 512; // taille finale de la photo (px)
const MAX_ZOOM = 4;

/**
 * Recadrage de la photo de profil : on déplace l'image avec le doigt / la souris,
 * on zoome avec le curseur, et le rond montre ce qui sera conservé.
 */
export default function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // déplacement depuis le centre (px écran)

  // Échelle de base : l'image couvre tout le carré
  const baseScale = () => (bitmap.current ? VIEW / Math.min(bitmap.current.width, bitmap.current.height) : 1);

  /** Garde l'image assez grande pour toujours remplir le carré */
  const clamp = useCallback(
    (o: { x: number; y: number }, z: number) => {
      const b = bitmap.current;
      if (!b) return o;
      const s = (VIEW / Math.min(b.width, b.height)) * z;
      const maxX = Math.max(0, (b.width * s - VIEW) / 2);
      const maxY = Math.max(0, (b.height * s - VIEW) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file)
      .then((b) => {
        if (cancelled) return;
        bitmap.current = b;
        setReady(true);
      })
      .catch(() => !cancelled && setError("Format d'image non pris en charge (essaie un JPEG ou un PNG)."));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const c = canvas.current;
    const b = bitmap.current;
    if (!c || !b || !ready) return;
    const ratio = 2; // netteté sur écrans haute densité
    c.width = c.height = VIEW * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    const s = baseScale() * zoom;
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(b, VIEW / 2 - (b.width * s) / 2 + offset.x, VIEW / 2 - (b.height * s) / 2 + offset.y, b.width * s, b.height * s);
    // Voile sombre autour du rond
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.rect(0, 0, VIEW, VIEW);
    ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 4, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
  }, [ready, zoom, offset]);

  const changeZoom = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setOffset((o) => clamp(o, next));
  };

  const confirm = () => {
    const b = bitmap.current;
    if (!b) return;
    const out = document.createElement("canvas");
    out.width = out.height = OUTPUT;
    const ctx = out.getContext("2d")!;
    const k = OUTPUT / VIEW;
    const s = baseScale() * zoom * k;
    ctx.drawImage(b, OUTPUT / 2 - (b.width * s) / 2 + offset.x * k, OUTPUT / 2 - (b.height * s) / 2 + offset.y * k, b.width * s, b.height * s);
    out.toBlob((blob) => (blob ? onConfirm(blob) : setError("Conversion impossible.")), "image/jpeg", 0.88);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recadrer la photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Recadrer la photo</h2>
        <p className="mt-1 text-xs text-muted">Glisse l&apos;image pour la placer, zoome avec le curseur.</p>

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : (
          <canvas
            ref={canvas}
            style={{ width: VIEW, height: VIEW, touchAction: "none" }}
            className="mx-auto mt-4 block cursor-grab rounded-lg bg-line active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x;
              const dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, zoom));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => changeZoom(zoom - e.deltaY * 0.002)}
          />
        )}

        {!error && (
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => changeZoom(zoom - 0.25)} aria-label="Dézoomer" className="btn-ghost h-9 w-9 justify-center px-0">
              −
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <button type="button" onClick={() => changeZoom(zoom + 0.25)} aria-label="Zoomer" className="btn-ghost h-9 w-9 justify-center px-0">
              +
            </button>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            Annuler
          </button>
          {!error && (
            <button type="button" onClick={confirm} disabled={!ready} className="btn-primary">
              Valider
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
