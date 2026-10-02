import SearchResult from "@/app/search/SearchResult";
import type { CatalogSearchResult } from "@/lib/catalog";
import { getOwnedIndex } from "@/lib/library";
import { createClient } from "@/lib/server";

/** Œuvres trouvées sur Google Books / BnF, sans celles déjà dans la bibliothèque */
export default async function ExternalWorks({
  search,
  userId,
  emptyLabel = "Aucune autre œuvre trouvée.",
}: {
  search: Promise<CatalogSearchResult>;
  userId: string;
  emptyLabel?: string;
}) {
  const supabase = await createClient();
  const [{ results, warnings }, owned] = await Promise.all([search, getOwnedIndex(supabase, userId)]);

  const others = results.filter(
    (c) => ![c.isbn13, c.isbn10, c.google_books_id].some((k) => k && owned.has(k))
  );

  return (
    <>
      {warnings.map((w) => (
        <p key={w} className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          {w}
        </p>
      ))}
      {others.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-line">
          {others.map((candidate) => (
            <li
              key={candidate.google_books_id ?? candidate.bnf_ark ?? candidate.isbn13 ?? candidate.title}
              className="py-4"
            >
              <SearchResult candidate={candidate} ownedUserBookId={null} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
