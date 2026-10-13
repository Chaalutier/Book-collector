"use client";

import { useState } from "react";

/**
 * Couverture avec repli automatique : image enregistrée → Open Library (par ISBN)
 * → carte colorée avec le titre.
 */
export default function BookCover({
  src,
  title,
  isbn,
  className = "",
}: {
  src: string | null;
  title: string;
  /** ISBN : sert à tenter Open Library si l'image principale manque ou est cassée */
  isbn?: string | null;
  className?: string;
}) {
  const sources = [src, isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null].filter(
    (s, i, all): s is string => !!s && all.indexOf(s) === i
  );
  const [attempt, setAttempt] = useState(0);
  const current = sources[attempt];

  if (!current) {
    return (
      <div
        className={`flex aspect-[2/3] items-center justify-center rounded-md bg-line p-3 text-center text-xs text-muted ${className}`}
      >
        {title}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- images de domaines externes variés
    <img
      // key : repart d'un état propre quand l'image change
      key={current}
      src={current}
      alt={`Couverture de ${title}`}
      loading="lazy"
      onError={() => setAttempt((n) => n + 1)}
      className={`aspect-[2/3] w-full rounded-md bg-line object-cover shadow-sm ${className}`}
    />
  );
}
