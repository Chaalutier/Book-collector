"use client";

import { useActionState } from "react";
import { addManualBook, type ActionResult } from "@/app/actions/library";
import { CATEGORY_LABELS, STATUS_DESCRIPTIONS } from "@/lib/labels";
import { BOOK_CATEGORIES, READING_STATUSES, type ReadingStatus } from "@/types/book";

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

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
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
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
