"use client";

import { useActionState } from "react";
import { renameAuthor } from "@/app/actions/origin";
import type { ActionResult } from "@/app/actions/library";

/** Correction du nom de l'auteur (fiche partagée) */
export default function NameForm({ authorId, name }: { authorId: number; name: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(renameAuthor, null);

  return (
    <details className="mt-2 text-sm">
      <summary className="inline-block cursor-pointer rounded-full border border-line bg-white px-3 py-1 text-muted hover:border-accent hover:text-accent-strong">
        ✎ Modifier
      </summary>
      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="author_id" value={authorId} />
        <input name="name" required defaultValue={name} maxLength={200} aria-label="Nom" className="field w-auto" />
        <button type="submit" disabled={pending} className="btn-ghost px-3 py-1 text-sm">
          {pending ? "…" : "Enregistrer"}
        </button>
        {state && (
          <span className={`text-xs ${state.ok ? "text-accent-strong" : "text-red-600"}`}>
            {state.ok ? state.message : state.error}
          </span>
        )}
      </form>
    </details>
  );
}
