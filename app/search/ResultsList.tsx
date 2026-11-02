"use client";

import { useState, useTransition } from "react";
import { searchPage, type SearchItem } from "@/app/actions/search";
import type { ReadingStatus } from "@/types/book";
import SearchResult from "./SearchResult";

const keyOf = ({ candidate: c }: SearchItem) => c.google_books_id ?? c.bnf_ark ?? c.isbn13 ?? c.title;

/** Résultats + « Charger plus » jusqu'à épuisement des catalogues */
export default function ResultsList({
  query,
  initial,
  initialHasMore,
  initialNextPage,
  quickStatus,
}: {
  query: string;
  initial: SearchItem[];
  initialHasMore: boolean;
  initialNextPage: number;
  quickStatus?: ReadingStatus;
}) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () =>
    startTransition(async () => {
      try {
        const page = await searchPage(query, nextPage);
        setItems((prev) => {
          const seen = new Set(prev.map(keyOf));
          return [...prev, ...page.items.filter((i) => !seen.has(keyOf(i)))];
        });
        setHasMore(page.hasMore);
        setNextPage(page.nextPage);
        setError(null);
      } catch {
        setError("Impossible de charger la suite. Réessaie.");
      }
    });

  return (
    <>
      <ul className="mt-8 divide-y divide-line">
        {items.map((item) => (
          <li key={keyOf(item)} className="py-4">
            <SearchResult candidate={item.candidate} ownedUserBookId={item.ownedUserBookId} quickStatus={quickStatus} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-4 text-center">
          <button type="button" onClick={loadMore} disabled={pending} className="btn-ghost">
            {pending ? "Chargement…" : "Charger plus"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </>
  );
}
