import Link from "next/link";
import { redirect } from "next/navigation";
import { searchPage } from "@/app/actions/search";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";
import ResultsList from "./ResultsList";
import SearchBox from "./SearchBox";

function manualHref(title: string, wishlist: boolean) {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (wishlist) params.set("to", "wishlist");
  const qs = params.toString();
  return qs ? `/search/manual?${qs}` : "/search/manual";
}

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
  const { items, warnings, hasMore, nextPage } = query
    ? await searchPage(query, 0)
    : { items: [], warnings: [] as string[], hasMore: false, nextPage: 1 };

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

      <Link
        href={wishlistMode ? "/scan?status=wishlist" : "/scan"}
        className="btn-ghost mt-5 w-full justify-center sm:w-auto"
      >
        📷 Scanner un code-barres
      </Link>

      {!query && (
        <Link href={manualHref("", wishlistMode)} className="btn-ghost ml-0 mt-2 w-full justify-center sm:ml-2 sm:w-auto">
          ✎ Ajouter à la main
        </Link>
      )}

      <SearchBox key={query} query={query} wishlistMode={wishlistMode} />

      {warnings.map((w) => (
        <p key={w} className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          {w}
        </p>
      ))}

      {query && items.length === 0 && (
        <p className="mt-10 text-center text-muted">Aucun résultat pour « {query} ».</p>
      )}

      {query && (
        <p className="mt-6 text-center text-sm text-muted">
          Introuvable, ou pas encore sorti ?{" "}
          <Link href={manualHref(query, wishlistMode)} className="font-medium text-accent-strong underline">
            Ajouter à la main
          </Link>
        </p>
      )}

      <ResultsList
        key={query}
        query={query}
        initial={items}
        initialHasMore={hasMore}
        initialNextPage={nextPage}
        quickStatus={wishlistMode ? "wishlist" : undefined}
      />

      {items.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted">
          Sources : Google Books et catalogue de la BnF.
        </p>
      )}
    </main>
  );
}
