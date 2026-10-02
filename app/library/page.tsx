import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getUserLibrary } from "@/lib/library";
import { createClient } from "@/lib/server";
import LibraryStats from "@/app/components/LibraryStats";
import LibraryView from "./LibraryView";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const params = await searchParams;

  let userBooks;
  try {
    userBooks = await getUserLibrary(supabase, user.id);
  } catch (error) {
    console.error(error);
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p>Impossible de charger ta bibliothèque. As-tu bien exécuté la migration SQL ?</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ma bibliothèque</h1>
          <p className="mt-1 text-sm text-muted">{userBooks.length} livre(s)</p>
        </div>
        <Link href="/search" className="btn-primary">
          + Ajouter un livre
        </Link>
      </div>

      {userBooks.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-lg font-medium">Ta bibliothèque est vide.</p>
          <p className="mt-1 text-sm text-muted">
            Cherche un titre, un auteur ou scanne l&apos;ISBN au dos du livre.
          </p>
          <Link href="/search" className="btn-primary mt-6">
            Ajouter mon premier livre
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <LibraryStats userBooks={userBooks} />
          </div>
          <LibraryView
          // Remonte la vue quand on arrive par un lien filtré (ex. bouton Wishlist du menu)
          key={`${params.status ?? ""}|${params.category ?? ""}|${params.view ?? ""}`}
          userBooks={userBooks}
          initialStatus={params.status}
          initialCategory={params.category}
          initialQuery={params.q}
          initialView={params.view}
          />
        </>
      )}
    </main>
  );
}
