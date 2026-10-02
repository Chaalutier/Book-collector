import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, ContributorRole, Profile, Series, UserBook } from "@/types/book";
import { createClient } from "./server";

/** Colonnes d'un livre + série + contributeurs, réutilisable dans les `select` */
export const BOOK_SELECT = `
  id, title, subtitle, description, category, series_id, volume_number,
  isbn10, isbn13, cover_url, publisher, published_date, page_count, language,
  google_books_id, bnf_ark, created_at,
  series ( id, title, category, total_volumes, is_finished ),
  book_contributors ( role, position, author:authors ( id, name ) )
`;

export const USER_BOOK_SELECT = `
  id, status, rating, notes, started_at, finished_at, created_at, updated_at,
  book:books ( ${BOOK_SELECT} )
`;

type RawContributor = { role: ContributorRole; position: number; author: { id: number; name: string } | null };
type RawBook = Omit<Book, "contributors" | "volume_number"> & {
  volume_number: number | string | null;
  book_contributors: RawContributor[] | null;
};
type RawUserBook = Omit<UserBook, "book"> & { book: RawBook };

export function mapBook(raw: RawBook): Book {
  const { book_contributors, ...rest } = raw;
  return {
    ...rest,
    volume_number: raw.volume_number === null ? null : Number(raw.volume_number),
    contributors: (book_contributors ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .filter((c) => c.author)
      .map((c) => ({ id: c.author!.id, name: c.author!.name, role: c.role })),
  };
}

export function mapUserBook(raw: RawUserBook): UserBook {
  return { ...raw, book: mapBook(raw.book) };
}

/** Utilisateur connecté (ou null) */
export async function getCurrentUser(supabase?: SupabaseClient) {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

export async function getProfile(userId: string, supabase?: SupabaseClient): Promise<Profile | null> {
  const client = supabase ?? (await createClient());
  const { data } = await client
    .from("profiles")
    .select("id, display_name, bio, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Toute la bibliothèque de l'utilisateur, triée par série puis tome */
export async function getUserLibrary(supabase: SupabaseClient, userId: string): Promise<UserBook[]> {
  const { data, error } = await supabase
    .from("user_books")
    .select(USER_BOOK_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as RawUserBook[]).map(mapUserBook);
}

export async function getUserBook(
  supabase: SupabaseClient,
  userId: string,
  userBookId: number
): Promise<UserBook | null> {
  const { data, error } = await supabase
    .from("user_books")
    .select(USER_BOOK_SELECT)
    .eq("user_id", userId)
    .eq("id", userBookId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapUserBook(data as unknown as RawUserBook) : null;
}

/** Livres d'une série présents dans la bibliothèque de l'utilisateur */
export async function getUserSeries(supabase: SupabaseClient, userId: string, seriesId: number) {
  const [{ data: series, error: seriesError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase
      .from("series")
      .select("id, title, category, total_volumes, is_finished")
      .eq("id", seriesId)
      .maybeSingle(),
    supabase
      .from("user_books")
      .select(`id, status, rating, notes, started_at, finished_at, created_at, updated_at, book:books!inner ( ${BOOK_SELECT} )`)
      .eq("user_id", userId)
      .eq("book.series_id", seriesId),
  ]);

  if (seriesError) throw seriesError;
  if (rowsError) throw rowsError;
  if (!series) return null;

  const books = (rows as unknown as RawUserBook[])
    .map(mapUserBook)
    .sort((a, b) => (a.book.volume_number ?? 9999) - (b.book.volume_number ?? 9999));

  return { series: series as Series, books };
}

/** Tomes manquants entre 1 et le dernier tome connu */
export function missingVolumes(owned: (number | null)[], total?: number | null): number[] {
  const numbers = new Set(
    owned.filter((v): v is number => v !== null && Number.isInteger(v)).map(Number)
  );
  if (numbers.size === 0) return [];
  const max = Math.max(total ?? 0, ...numbers);
  const missing: number[] = [];
  for (let i = 1; i <= max; i++) if (!numbers.has(i)) missing.push(i);
  return missing;
}

/** Statut de l'utilisateur pour une liste de livres du catalogue : book_id → { id, status } */
async function getUserStatusByBook(supabase: SupabaseClient, userId: string, bookIds: number[]) {
  const map = new Map<number, { id: number; status: UserBook["status"] }>();
  if (bookIds.length === 0) return map;
  const { data, error } = await supabase
    .from("user_books")
    .select("id, status, book_id")
    .eq("user_id", userId)
    .in("book_id", bookIds);
  if (error) throw error;
  for (const row of (data ?? []) as { id: number; status: UserBook["status"]; book_id: number }[]) {
    map.set(row.book_id, { id: row.id, status: row.status });
  }
  return map;
}

export type CatalogWork = { book: Book; mine: { id: number; status: UserBook["status"] } | null };

function sortWorks(works: CatalogWork[]) {
  return works.sort((a, b) => {
    const sa = a.book.series?.title ?? a.book.title;
    const sb = b.book.series?.title ?? b.book.title;
    return (
      sa.localeCompare(sb, "fr") ||
      (a.book.volume_number ?? 9999) - (b.book.volume_number ?? 9999) ||
      a.book.title.localeCompare(b.book.title, "fr")
    );
  });
}

async function attachMine(supabase: SupabaseClient, userId: string, books: Book[]): Promise<CatalogWork[]> {
  const mine = await getUserStatusByBook(supabase, userId, books.map((b) => b.id));
  return sortWorks(books.map((book) => ({ book, mine: mine.get(book.id) ?? null })));
}

/** Fiche d'un auteur + ses livres connus du catalogue (ceux déjà ajoutés par n'importe quel utilisateur) */
export async function getAuthorWorks(supabase: SupabaseClient, userId: string, authorId: number) {
  const { data: author, error } = await supabase
    .from("authors")
    .select("id, name")
    .eq("id", authorId)
    .maybeSingle();
  if (error) throw error;
  if (!author) return null;

  const { data: links, error: linksError } = await supabase
    .from("book_contributors")
    .select("book_id, role")
    .eq("author_id", authorId);
  if (linksError) throw linksError;

  const rows = (links ?? []) as { book_id: number; role: ContributorRole }[];
  const roles: ContributorRole[] = [...new Set(rows.map((l) => l.role))];
  const ids: number[] = [...new Set(rows.map((l) => l.book_id))];

  let books: Book[] = [];
  if (ids.length > 0) {
    const { data, error: booksError } = await supabase.from("books").select(BOOK_SELECT).in("id", ids);
    if (booksError) throw booksError;
    books = (data as unknown as RawBook[]).map(mapBook);
  }

  return {
    author: author as { id: number; name: string },
    roles,
    works: await attachMine(supabase, userId, books),
  };
}

/** Livres du catalogue d'un éditeur (correspondance exacte, sans tenir compte de la casse) */
export async function getPublisherWorks(supabase: SupabaseClient, userId: string, publisher: string) {
  // ilike sans joker = égalité insensible à la casse ; on échappe % _ \
  const pattern = publisher.replace(/[\\%_]/g, (m) => `\\${m}`);
  const { data, error } = await supabase.from("books").select(BOOK_SELECT).ilike("publisher", pattern);
  if (error) throw error;
  const books = (data as unknown as RawBook[]).map(mapBook);
  return { works: await attachMine(supabase, userId, books) };
}

/** Clés d'identification (ISBN, id Google) des livres de la bibliothèque → id du user_book */
export async function getOwnedIndex(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_books")
    .select("id, book:books ( isbn13, isbn10, google_books_id )")
    .eq("user_id", userId);
  if (error) throw error;
  const owned = new Map<string, number>();
  type Row = { id: number; book: { isbn13: string | null; isbn10: string | null; google_books_id: string | null } | null };
  for (const row of (data ?? []) as unknown as Row[]) {
    for (const key of [row.book?.isbn13, row.book?.isbn10, row.book?.google_books_id]) {
      if (key) owned.set(key, row.id);
    }
  }
  return owned;
}
