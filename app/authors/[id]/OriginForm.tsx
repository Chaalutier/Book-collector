"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { detectOrigins, setAuthorOrigin } from "@/app/actions/origin";
import { ORIGINS } from "@/lib/origin";

/** Origine de l'auteur (type de littérature), affichée dans la wishlist */
export default function OriginForm({ authorId, origin }: { authorId: number; origin: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(origin ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (next: string) => {
    setValue(next);
    startTransition(async () => {
      const result = await setAuthorOrigin(authorId, next || null);
      setMessage(result.ok ? "Enregistré." : result.error);
      if (result.ok) router.refresh();
    });
  };

  const detect = () =>
    startTransition(async () => {
      setMessage(null);
      // detectOrigins ignore les auteurs déjà renseignés : on efface d'abord pour relancer la détection
      if (value) await setAuthorOrigin(authorId, null);
      const result = await detectOrigins([authorId]);
      if (!result.ok) return setMessage(result.error);
      if (result.data?.found) {
        setMessage("Origine trouvée.");
        router.refresh();
      } else {
        setMessage("Introuvable automatiquement : choisis-la dans la liste.");
        setValue("");
      }
    });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <label className="text-muted" htmlFor="origin">
        Origine
      </label>
      <select
        id="origin"
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        className="field w-auto"
      >
        <option value="">Non renseignée</option>
        {ORIGINS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button type="button" onClick={detect} disabled={pending} className="btn-ghost px-3 py-1 text-sm">
        {pending ? "…" : "Détecter"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
