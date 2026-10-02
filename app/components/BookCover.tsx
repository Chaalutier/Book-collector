"use client";

import { useState } from "react";

/** Couverture avec repli propre si l'image est absente ou cassée */
export default function BookCover({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
      src={src}
      alt={`Couverture de ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-[2/3] w-full rounded-md bg-line object-cover shadow-sm ${className}`}
    />
  );
}
