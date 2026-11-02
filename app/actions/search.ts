"use server";

import { searchCatalog } from "@/lib/catalog";
import { createClient } from "@/lib/server";
import type { BookCandidate } from "@/types/book";

type OwnedRow = {
  id: number;
  book: { isbn13: string | null; isbn10: string | null; google_books_id: string | null } | null;
};

export type SearchItem = { candidate: BookCandidate; ownedUserBookId: number | null };

/**
 * Une page de résultats, avec les livres déjà dans la bibliothèque repérés.
 * Une page entièrement écartée (hors sujet, étrangère…) ne doit pas bloquer « Charger plus » :
 * on enchaîne jusqu'à 6 pages pour trouver quelque chose.
 */
export async function searchPage(
  query: string,
  page: number
): Promise<{ items: SearchItem[]; warnings: string[]; hasMore: boolean; nextPage: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], warnings: ["Non connecté."], hasMore: false, nextPage: page };

  let current = Math.max(0, Math.floor(page));
  let found = await searchCatalog(query, { page: current });
  while (found.results.length === 0 && found.hasMore && current < page + 5) {
    current++;
    found = await searchCatalog(query, { page: current });
  }

  const owned = new Map<string, number>();
  if (found.results.length > 0) {
    const { data } = await supabase
      .from("user_books")
      .select("id, book:books ( isbn13, isbn10, google_books_id )")
      .eq("user_id", user.id);
    for (const row of (data ?? []) as unknown as OwnedRow[]) {
      for (const key of [row.book?.isbn13, row.book?.isbn10, row.book?.google_books_id]) {
        if (key) owned.set(key, row.id);
      }
    }
  }

  const items = found.results.map((candidate) => ({
    candidate,
    ownedUserBookId:
      [candidate.isbn13, candidate.isbn10, candidate.google_books_id]
        .map((k) => (k ? owned.get(k) : undefined))
        .find((v) => v !== undefined) ?? null,
  }));
  return { items, warnings: found.warnings, hasMore: found.hasMore, nextPage: current + 1 };
}
