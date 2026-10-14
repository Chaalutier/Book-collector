"use client";

import { useActionState, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addManualBook, type ActionResult } from "@/app/actions/library";
import { CATEGORY_LABELS, STATUS_DESCRIPTIONS } from "@/lib/labels";
import { BOOK_CATEGORIES, READING_STATUSES, type ReadingStatus } from "@/types/book";

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

export default function ManualForm({
  initialTitle,
  initialStatus,
  initialDate = "",
  back = "",
}: {
  initialTitle: string;
  initialStatus: ReadingStatus;
  initialDate?: string;
  /** "calendar" : revenir au calendrier après l'ajout */
  back?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addManualBook, null);
  const [coverUrl, setCoverUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setCoverError("Choisis une image.");
    setUploading(true);
    setCoverError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Non connecté");
      const blob = await toJpeg(file);
      const path = `${auth.user.id}/new-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("covers")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      setCoverUrl(supabase.storage.from("covers").getPublicUrl(path).data.publicUrl);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
      setCoverError("Envoi impossible. As-tu exécuté la migration « couvertures » ?");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="cover_url" value={coverUrl} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="relative flex h-28 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-black/20 bg-black/5 text-center text-[11px] text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="px-1">{uploading ? "Envoi…" : "📷 Couverture"}</span>}
          <input type="file" accept="image/*" onChange={onCover} className="hidden" disabled={uploading} />
        </label>
        <div className="text-xs text-muted">
          <p>Ajoute une photo de la couverture (facultatif).</p>
          {coverUrl && (
            <button type="button" onClick={() => { setCoverUrl(""); setPreview(null); }} className="mt-1 underline">
              Retirer
            </button>
          )}
          {coverError && <p className="mt-1 text-red-600">{coverError}</p>}
        </div>
      </div>
      <label className="text-sm sm:col-span-2">
        Titre *
        <input name="title" required defaultValue={initialTitle} className="field mt-1 text-base" />
      </label>

      <label className="text-sm">
        Catégorie
        <select name="category" defaultValue="novel" className="field mt-1">
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Statut
        <select name="status" defaultValue={initialStatus} className="field mt-1">
          {READING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_DESCRIPTIONS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Série
        <input name="series_title" placeholder="Aucune (one-shot)" className="field mt-1" />
      </label>

      <label className="text-sm">
        Tome
        <input name="volume_number" inputMode="decimal" placeholder="ex. 3" className="field mt-1" />
      </label>

      <label className="text-sm sm:col-span-2">
        Auteur(s)
        <input name="authors" placeholder="Séparés par une virgule" className="field mt-1" />
      </label>

      <label className="text-sm">
        Date de sortie
        <input name="published_date" defaultValue={initialDate} placeholder="05/11/2026, 11/2026 ou 2026" className="field mt-1" />
        <span className="mt-1 block text-[11px] text-muted">Une date partielle suffit (mois ou année).</span>
      </label>

      <label className="text-sm">
        Éditeur
        <input name="publisher" className="field mt-1" />
      </label>

      <label className="text-sm sm:col-span-2">
        ISBN (si tu l&apos;as)
        <input name="isbn" inputMode="numeric" placeholder="978…" className="field mt-1" />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending || uploading} className="btn-primary">
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
