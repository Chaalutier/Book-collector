"use client";

import { useState } from "react";

/**
 * Note de 0,5 à 5 par demi-étoiles : chaque étoile a une moitié gauche (x,5) et une moitié droite (x).
 * Un second clic sur la note actuelle l'efface. Envoie la valeur via un champ caché `name`.
 */
export default function StarRating({
  name,
  defaultValue = null,
}: {
  name: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  const pick = (v: number) => setValue((current) => (current === v ? null : v));

  return (
    <div className="mt-1 flex items-center gap-3">
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, shown - (star - 1))) * 100;
          return (
            <span key={star} className="relative inline-block h-9 w-9 text-4xl leading-9 select-none">
              <span className="absolute inset-0 text-center text-line">★</span>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden text-center text-amber-500"
                style={{ width: `${fill}%` }}
                aria-hidden
              >
                <span className="block w-9">★</span>
              </span>
              {[star - 0.5, star].map((v, i) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value === v}
                  aria-label={`${v} sur 5`}
                  onClick={() => pick(v)}
                  onMouseEnter={() => setHover(v)}
                  className={`absolute inset-y-0 w-1/2 ${i === 0 ? "left-0" : "right-0"}`}
                />
              ))}
            </span>
          );
        })}
      </div>
      <span className="min-w-12 text-sm text-muted">
        {value !== null ? `${String(value).replace(".", ",")} / 5` : "Pas de note"}
      </span>
    </div>
  );
}
