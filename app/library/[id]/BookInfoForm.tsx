"use client";

import { useActionState, useState, useTransition } from "react";
import { detectCategory, updateBookInfo, type ActionResult } from "@/app/actions/library";
import { CATEGORY_LABELS } from "@/lib/labels";
import { BOOK_CATEGORIES, type Book, type BookCategory } from "@/types/book";

export default function BookInfoForm({ book }: { book: Book }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateBookInfo, null);
  const [category, setCategory] = useState<BookCategory>(book.category);
  const [detection, setDetection] = useState<string | null>(null);
  const [detecting, startDetect] = useTransition();

  const detect = () =>
    startDetect(async () => {
      const result = await detectCategory(book.id);
      if (!result.ok) return setDetection(result.error);
      if (!result.data) return;
      setCategory(result.data.category);
      setDetection(
        `${CATEGORY_LABELS[result.data.category]}${
          result.data.reasons.length ? ` : ${result.data.reasons.join(" · ")}` : ""
        } — pense à enregistrer.`
      );
    });

  return (
    <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="book_id" value={book.id} />

      <label className="text-sm sm:col-span-3">
        Titre
        <input name="title" required defaultValue={book.title} className="field mt-1" />
      </label>

      <div className="text-sm">
        <label htmlFor={`category-${book.id}`}>Catégorie</label>
        <div className="mt-1 flex gap-2">
          <select
            id={`category-${book.id}`}
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BookCategory)}
            className="field"
          >
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={detect}
            disabled={detecting}
            title="Détecter automatiquement (Google Books + BnF)"
            className="btn-ghost shrink-0 px-3"
          >
            {detecting ? "…" : "Auto"}
          </button>
        </div>
        {detection && <p className="mt-1 text-[11px] text-muted">{detection}</p>}
      </div>

      <label className="text-sm">
        Série
        <input
          name="series_title"
          defaultValue={book.series?.title ?? ""}
          placeholder="Aucune (one-shot)"
          className="field mt-1"
        />
      </label>

      <label className="text-sm">
        Tome
        <input
          name="volume_number"
          inputMode="decimal"
          defaultValue={book.volume_number ?? ""}
          placeholder="ex. 3"
          className="field mt-1"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-ghost">
          {pending ? "Enregistrement…" : "Mettre à jour la fiche"}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-accent-strong" : "text-red-600"}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
        <p className="ml-auto text-xs text-muted">La fiche est partagée par tous les lecteurs.</p>
      </div>
    </form>
  );
}
