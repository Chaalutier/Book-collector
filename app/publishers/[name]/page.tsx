import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import ExternalWorks from "@/app/components/ExternalWorks";
import WorksGrid from "@/app/components/WorksGrid";
import { searchByPublisher } from "@/lib/catalog";
import { getCurrentUser, getPublisherWorks } from "@/lib/library";
import { createClient } from "@/lib/server";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function PublisherPage({ params }: { params: Promise<{ name: string }> }) {
  const name = safeDecode((await params).name).trim();
  if (!name) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const { works } = await getPublisherWorks(supabase, user.id, name);
  // Un éditeur inconnu du catalogue reste consultable (on cherche ses livres en ligne)
  const displayName = works[0]?.book.publisher ?? name;
  const myWorks = works.filter((w) => w.mine);
  const mineCount = myWorks.length;

  // Auteurs les plus présents chez cet éditeur
  const authors = new Map<number, { name: string; count: number }>();
  for (const { book } of works) {
    for (const c of book.contributors) {
      if (c.id === undefined) continue;
      const entry = authors.get(c.id) ?? { name: c.name, count: 0 };
      entry.count++;
      authors.set(c.id, entry);
    }
  }
  const topAuthors = [...authors.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        ← Ma bibliothèque
      </Link>

      <header className="mt-6">
        <p className="text-sm text-muted">Maison d&apos;édition</p>
        <h1 className="text-3xl font-bold">{displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          {works.length} livre{works.length > 1 ? "s" : ""} au catalogue · {mineCount} dans ma bibliothèque
        </p>
        {topAuthors.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="text-muted">Auteurs</span>
            {topAuthors.map(([id, a]) => (
              <Link
                key={id}
                href={`/authors/${id}`}
                className="rounded-full border border-line bg-white px-2.5 py-0.5 hover:border-accent hover:text-accent-strong"
              >
                {a.name}
              </Link>
            ))}
          </p>
        )}
      </header>

      {myWorks.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Dans ma bibliothèque</h2>
          <WorksGrid works={myWorks} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Autres livres</h2>
        <p className="mb-4 text-sm text-muted">Les plus récents, trouvés sur Google Books et à la BnF.</p>
        <Suspense fallback={<p className="text-sm text-muted">Recherche de ses livres…</p>}>
          <ExternalWorks search={searchByPublisher(displayName)} userId={user.id} />
        </Suspense>
      </section>
    </main>
  );
}
