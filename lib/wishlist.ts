import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookCategory, ContributorRole } from "@/types/book";

export type WishItem = {
  /** id du user_book (lien vers la fiche) */
  id: number;
  status: "wishlist" | "ordered";
  title: string;
  volume: number | null;
  series: string | null;
  cover: string | null;
  date: string | null;
  authors: { id: number; name: string }[];
  origin: string | null;
  /** Origine déduite (manga → japonaise) et non enregistrée */
  originGuess: boolean;
};

export type WishGroup = { key: string; title: string | null; items: WishItem[] };

type Raw = {
  id: number;
  status: "wishlist" | "ordered";
  book: {
    title: string;
    volume_number: number | string | null;
    cover_url: string | null;
    published_date: string | null;
    category: BookCategory;
    series: { id: number; title: string } | null;
    book_contributors:
      | { role: ContributorRole; position: number; author: { id: number; name: string; origin?: string | null } | null }[]
      | null;
  };
};

const SELECT = (withOrigin: boolean) => `
  id, status,
  book:books!inner (
    title, volume_number, cover_url, published_date, category,
    series ( id, title ),
    book_contributors ( role, position, author:authors ( id, name${withOrigin ? ", origin" : ""} ) )
  )
`;

/** Requête volontairement légère : pas de résumé, d'éditeur ni d'ISBN (chargement rapide en 3G) */
export async function getWishlist(supabase: SupabaseClient, userId: string): Promise<WishItem[]> {
  const run = (withOrigin: boolean) =>
    supabase.from("user_books").select(SELECT(withOrigin)).eq("user_id", userId).in("status", ["wishlist", "ordered"]);

  let { data, error } = await run(true);
  // Colonne « origin » absente tant que la migration n'a pas été exécutée
  if (error?.code === "42703") ({ data, error } = await run(false));
  if (error) throw error;

  return ((data ?? []) as unknown as Raw[]).map((row) => {
    const { book } = row;
    const people = (book.book_contributors ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .filter((c) => c.author && c.role !== "translator");
    const origin = people.map((c) => c.author?.origin).find((o): o is string => !!o) ?? null;
    return {
      id: row.id,
      status: row.status,
      title: book.title,
      volume: book.volume_number === null ? null : Number(book.volume_number),
      series: book.series?.title ?? null,
      cover: book.cover_url,
      date: book.published_date,
      authors: people.slice(0, 3).map((c) => ({ id: c.author!.id, name: c.author!.name })),
      origin: origin ?? (book.category === "manga" ? "Japonaise" : null),
      originGuess: !origin && book.category === "manga",
    };
  });
}

/** Regroupe par série (tomes dans l'ordre), puis les livres seuls par titre */
export function groupWishlist(items: WishItem[]): WishGroup[] {
  const bySeries = new Map<string, WishItem[]>();
  const singles: WishItem[] = [];
  for (const item of items) {
    if (item.series) bySeries.set(item.series, [...(bySeries.get(item.series) ?? []), item]);
    else singles.push(item);
  }
  const groups: WishGroup[] = [...bySeries.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([title, list]) => ({
      key: `s:${title}`,
      title,
      items: list.sort((a, b) => (a.volume ?? 9999) - (b.volume ?? 9999) || a.title.localeCompare(b.title, "fr")),
    }));
  if (singles.length > 0) {
    groups.push({
      key: "singles",
      title: null,
      items: singles.sort((a, b) => a.title.localeCompare(b.title, "fr")),
    });
  }
  return groups;
}
