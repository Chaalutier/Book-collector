import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import ExternalWorks from "@/app/components/ExternalWorks";
import WorksGrid from "@/app/components/WorksGrid";
import { searchByAuthor } from "@/lib/catalog";
import { ROLE_LABELS } from "@/lib/labels";
import { getAuthorWorks, getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const authorId = Number(id);
  if (!Number.isInteger(authorId)) notFound();

  const data = await getAuthorWorks(supabase, user.id, authorId);
  if (!data) notFound();

  const { author, roles, works } = data;
  const myWorks = works.filter((w) => w.mine);
  const mineCount = myWorks.length;
  const publishers = [...new Set(works.map((w) => w.book.publisher).filter((p): p is string => !!p))];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        ← Ma bibliothèque
      </Link>

      <header className="mt-6">
        <p className="text-sm text-muted">Auteur</p>
        <h1 className="text-3xl font-bold">{author.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {roles.map((r) => ROLE_LABELS[r]).join(", ")} · {works.length} livre{works.length > 1 ? "s" : ""} au catalogue
          · {mineCount} dans ma bibliothèque
        </p>
        {publishers.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="text-muted">Publié chez</span>
            {publishers.map((p) => (
              <Link
                key={p}
                href={`/publishers/${encodeURIComponent(p)}`}
                className="rounded-full border border-line bg-white px-2.5 py-0.5 hover:border-accent hover:text-accent-strong"
              >
                {p}
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
        <h2 className="text-lg font-semibold">Autres œuvres</h2>
        <p className="mb-4 text-sm text-muted">Trouvées sur Google Books et à la BnF.</p>
        <Suspense fallback={<p className="text-sm text-muted">Recherche de ses œuvres…</p>}>
          <ExternalWorks search={searchByAuthor(author.name)} userId={user.id} />
        </Suspense>
      </section>
    </main>
  );
}
