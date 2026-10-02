"use client";

import { useActionState } from "react";
import { updateUserBook, type ActionResult } from "@/app/actions/library";
import { STATUS_DESCRIPTIONS } from "@/lib/labels";
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

      <label className="text-sm">
        Note
        <select name="rating" defaultValue={userBook.rating ?? ""} className="field mt-1">
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
              {"☆".repeat(5 - n)}
            </option>
          ))}
        </select>
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
