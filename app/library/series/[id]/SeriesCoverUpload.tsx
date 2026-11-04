"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSeriesCover } from "@/app/actions/library";
import BookCover from "@/app/components/BookCover";
import { supabase } from "@/lib/supabase";

const MAX_SIDE = 900;

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("conversion"))), "image/jpeg", 0.85)
  );
}

/** Couverture de la série : un clic dessus pour la changer, ou choisir celle d'un tome */
export default function SeriesCoverUpload({
  seriesId,
  userId,
  title,
  cover,
  custom,
  volumeCovers,
}: {
  seriesId: number;
  userId: string;
  title: string;
  /** Couverture actuellement affichée pour la série */
  cover: string | null;
  /** true si elle a été choisie (et non celle du premier tome) */
  custom: boolean;
  /** Couvertures des tomes, proposées en un clic */
  volumeCovers: { url: string; label: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = async (url: string | null) => {
    const result = await setSeriesCover(seriesId, url);
    if (!result.ok) throw new Error(result.error);
    startTransition(() => router.refresh());
  };

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choisis une image.");
    await run(async () => {
      const blob = await toJpeg(file);
      const path = `${userId}/series-${seriesId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (uploadError) throw new Error("Envoi impossible. As-tu exécuté la migration « couvertures » ?");
      await save(supabase.storage.from("covers").getPublicUrl(path).data.publicUrl);
    });
  };

  return (
    <div className="w-32 shrink-0">
      <input ref={input} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Changer la couverture de la série"
        className="group relative block w-full cursor-pointer overflow-hidden rounded-md text-left"
      >
        <BookCover src={cover} title={title} />
        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-center text-xs font-medium text-white">
          {busy ? "Envoi…" : "📷 Changer"}
        </span>
      </button>

      {volumeCovers.length > 1 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">Prendre celle d&apos;un tome</summary>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {volumeCovers.map((v) => (
              <button
                key={v.url}
                type="button"
                disabled={busy}
                title={v.label}
                onClick={() => run(() => save(v.url))}
                className={`overflow-hidden rounded ${v.url === cover ? "ring-2 ring-accent" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.url} alt={v.label} loading="lazy" className="aspect-[2/3] w-full object-cover" />
              </button>
            ))}
          </div>
        </details>
      )}

      {custom && (
        <button type="button" disabled={busy} onClick={() => run(() => save(null))} className="mt-2 text-xs text-muted underline">
          Revenir à la couverture automatique
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
