import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BookCard from "@/app/components/BookCard";
import { CATEGORY_LABELS, formatContributors, formatVolume } from "@/lib/labels";
import { getCurrentUser, getUserLibrary, getUserSeries, missingVolumes } from "@/lib/library";
import { createClient } from "@/lib/server";
import SeriesForm from "./SeriesForm";

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const seriesId = Number(id);
  if (!Number.isInteger(seriesId)) notFound();

  const [result, library] = await Promise.all([
    getUserSeries(supabase, user.id, seriesId),
    getUserLibrary(supabase, user.id),
  ]);
  if (!result) notFound();

  const { series, books } = result;
  const owned = books.filter((b) => b.status !== "wishlist");
  const read = books.filter((b) => b.status === "read").length;
  const missing = missingVolumes(
    books.map((b) => b.book.volume_number),
    series.total_volumes
  );
  const contributors = books[0]?.book.contributors ?? [];

  // Séries candidates à une fusion (même catégorie, dans ma bibliothèque)
  const otherSeries = [
    ...new Map(
      library
        .map((ub) => ub.book.series)
        .filter((s): s is NonNullable<typeof s> => !!s && s.id !== series.id && s.category === series.category)
        .map((s) => [s.id, { id: s.id, title: s.title }])
    ).values(),
  ].sort((a, b) => a.title.localeCompare(b.title, "fr"));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        ← Ma bibliothèque
      </Link>

      <header className="mt-4">
        <p className="text-sm text-muted">{CATEGORY_LABELS[series.category]} · série</p>
        <h1 className="text-3xl font-bold">{series.title}</h1>
        {contributors.length > 0 && (
          <p className="mt-1 text-muted">{formatContributors(contributors, { withRoles: true })}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Possédés" value={`${owned.length}${series.total_volumes ? ` / ${series.total_volumes}` : ""}`} />
          <Stat label="Lus" value={String(read)} />
          <Stat label="Wishlist" value={String(books.length - owned.length)} />
          <Stat label="Statut" value={series.is_finished ? "Terminée" : "En cours"} />
        </div>

        {missing.length > 0 && (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
            Tomes manquants : {missing.map((v) => formatVolume(v)).join(", ")}
          </p>
        )}
      </header>

      <details className="mt-6 rounded-xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Modifier la série (nom, tomes parus, fusion)</summary>
        <SeriesForm series={series} otherSeries={otherSeries} />
      </details>

      <div className="book-grid mt-8">
        {books.map((ub) => (
          <BookCard key={ub.id} userBook={ub} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href={`/search?q=${encodeURIComponent(series.title)}`} className="btn-ghost">
          + Ajouter un tome de {series.title}
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
