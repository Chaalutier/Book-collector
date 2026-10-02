import Link from "next/link";
import { redirect } from "next/navigation";
import { searchCatalog } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";
import type { BookCandidate } from "@/types/book";
import SearchResult from "./SearchResult";

type OwnedRow = {
  id: number;
  book: { isbn13: string | null; isbn10: string | null; google_books_id: string | null } | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; to?: string }>;
}) {
  const { q = "", to } = await searchParams;
  // /search?to=wishlist : ajout en un clic directement dans la wishlist
  const wishlistMode = to === "wishlist";
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const query = q.trim();
  const { results, warnings } = query
    ? await searchCatalog(query)
    : { results: [] as BookCandidate[], warnings: [] as string[] };

  // Repère les livres déjà dans la bibliothèque
  const owned = new Map<string, number>();
  if (results.length > 0) {
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

  const ownedId = (c: BookCandidate) =>
    [c.isbn13, c.isbn10, c.google_books_id]
      .map((k) => (k ? owned.get(k) : undefined))
      .find((v) => v !== undefined) ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">
        {wishlistMode ? "Ajouter à ma wishlist" : "Ajouter un livre"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Titre, auteur, série + n° de tome (« One Piece 42 ») ou ISBN.
      </p>

      {/* Formulaire GET : l'URL /search?q=… reste partageable */}
      {wishlistMode && (
        <p className="mt-3 rounded-lg bg-soft px-3 py-2 text-sm">
          ♡ Mode wishlist : un clic suffit, le livre est ajouté directement avec le statut Wishlist.{" "}
          <Link href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"} className="underline">
            Ajout classique
          </Link>
        </p>
      )}

      <form action="/search" className="mt-6 flex gap-2">
        {wishlistMode && <input type="hidden" name="to" value="wishlist" />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Rechercher…"
          className="field text-base"
        />
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      {warnings.map((w) => (
        <p key={w} className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          {w}
        </p>
      ))}

      {query && results.length === 0 && (
        <p className="mt-10 text-center text-muted">Aucun résultat pour « {query} ».</p>
      )}

      <ul className="mt-8 divide-y divide-line">
        {results.map((candidate) => (
          <li
            key={candidate.google_books_id ?? candidate.bnf_ark ?? candidate.isbn13 ?? candidate.title}
            className="py-4"
          >
            <SearchResult
              candidate={candidate}
              ownedUserBookId={ownedId(candidate)}
              quickStatus={wishlistMode ? "wishlist" : undefined}
            />
          </li>
        ))}
      </ul>

      {results.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted">
          Sources : Google Books et catalogue de la BnF.
        </p>
      )}
    </main>
  );
}
