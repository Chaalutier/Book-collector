"use client";

import { useActionState } from "react";
import { updateUserBook, type ActionResult } from "@/app/actions/library";
import { STATUS_DESCRIPTIONS } from "@/lib/labels";
import StarRating from "@/app/components/StarRating";
import { READING_STATUSES, type UserBook } from "@/types/book";

export default function UserBookForm({ userBook }: { userBook: UserBook }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateUserBook, null);

  return (
    <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={userBook.id} />

      <label className="text-sm">
        Statut
        <select name="status" defaultValue={userBook.status} className="field mt-1">
          {READING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_DESCRIPTIONS[s]}
            </option>
          ))}
        </select>
      </label>

      <div className="text-sm sm:col-span-2">
        Note
        <StarRating name="rating" defaultValue={userBook.rating} />
      </div>

      <label className="text-sm sm:col-span-2">
        Page où je me suis arrêté
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            name="current_page"
            min={0}
            max={userBook.book.page_count ?? undefined}
            inputMode="numeric"
            defaultValue={userBook.current_page ?? ""}
            placeholder="ex. 142"
            className="field w-32"
          />
          {userBook.book.page_count && <span className="text-muted">sur {userBook.book.page_count} pages</span>}
        </div>
      </label>

      <label className="text-sm">
        Commencé le
        <input type="date" name="started_at" defaultValue={userBook.started_at ?? ""} className="field mt-1" />
      </label>

      <label className="text-sm">
        Terminé le
        <input type="date" name="finished_at" defaultValue={userBook.finished_at ?? ""} className="field mt-1" />
      </label>

      <label className="text-sm sm:col-span-2">
        Mes notes
        <textarea
          name="notes"
          rows={4}
          defaultValue={userBook.notes ?? ""}
          placeholder="Avis, citations, à qui je l'ai prêté…"
          className="field mt-1"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-accent-strong" : "text-red-600"}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  );
}
