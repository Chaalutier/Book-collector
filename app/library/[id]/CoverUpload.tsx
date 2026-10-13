"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBookCover } from "@/app/actions/library";
import { supabase } from "@/lib/supabase";

const MAX_SIDE = 900; // px : largement assez pour une couverture, et reste léger

/** Réduit la photo (souvent 12 Mpx sur téléphone) et la convertit en JPEG */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("conversion"))), "image/jpeg", 0.85)
  );
}

export default function CoverUpload({
  bookId,
  userId,
  children,
}: {
  bookId: number;
  userId: string;
  /** La couverture affichée : un clic dessus ouvre l'appareil photo / la galerie */
  children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choisis une image.");

    setBusy(true);
    setError(null);
    try {
      const blob = await toJpeg(file);
      const path = `${userId}/${bookId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      const result = await setBookCover(bookId, data.publicUrl);
      if (!result.ok) throw new Error(result.error);
      startTransition(() => router.refresh());
    } catch (e) {
      console.error(e);
      setError("Envoi impossible. As-tu exécuté la migration « couvertures » ?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept="image/*" onChange={onChange} className="hidden" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Changer la couverture"
        className="group relative block w-full cursor-pointer overflow-hidden rounded-md text-left"
      >
        {children}
        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-xs font-medium text-white">
          {busy ? "Envoi…" : "📷 Changer la couverture"}
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="book-loader" style={{ width: 28, height: 28, borderWidth: 3, ["--book-loader-color" as string]: "#fff" }} />
          </span>
        )}
      </button>
      {error && <p className="mt-1 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
