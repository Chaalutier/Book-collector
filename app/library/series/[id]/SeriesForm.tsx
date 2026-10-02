"use client";

import { useActionState } from "react";
import { mergeSeries, updateSeries, type ActionResult } from "@/app/actions/library";
import type { Series } from "@/types/book";

export default function SeriesForm({
  series,
  otherSeries,
}: {
  series: Series;
  /** Autres séries de la même catégorie présentes dans la bibliothèque */
  otherSeries: { id: number; title: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateSeries, null);

  return (
    <div className="mt-4 grid gap-6">
      <form action={formAction} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="id" value={series.id} />
        <label className="min-w-56 flex-1 text-sm">
          Nom de la série
          <input name="title" required defaultValue={series.title} className="field mt-1" />
        </label>
        <label className="text-sm">
          Tomes parus
          <input
            type="number"
            min={1}
            name="total_volumes"
            defaultValue={series.total_volumes ?? ""}
            className="field mt-1 w-28"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="is_finished" defaultChecked={series.is_finished} />
          Série terminée
        </label>
        <button type="submit" disabled={pending} className="btn-ghost">
          {pending ? "…" : "Enregistrer"}
        </button>
        {state && (
          <p className={`w-full text-sm ${state.ok ? "text-accent-strong" : "text-red-600"}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </form>

      {otherSeries.length > 0 && (
        <form
          action={mergeSeries}
          onSubmit={(event) => {
            if (!confirm("Déplacer tous les tomes dans la série choisie et supprimer celle-ci ?")) {
              event.preventDefault();
            }
          }}
          className="flex flex-wrap items-end gap-4 border-t border-line pt-4"
        >
          <input type="hidden" name="source_id" value={series.id} />
          <label className="min-w-56 flex-1 text-sm">
            Doublon ? Fusionner cette série dans…
            <select name="target_id" required defaultValue="" className="field mt-1">
              <option value="" disabled>
                Choisir une série
              </option>
              {otherSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-ghost">
            Fusionner
          </button>
        </form>
      )}
    </div>
  );
}
