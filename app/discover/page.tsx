import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import ExternalWorks from "@/app/components/ExternalWorks";
import { searchByTheme } from "@/lib/catalog";
import { THEMES, findTheme } from "@/lib/catalog/themes";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const theme = findTheme(params.theme);
  const page = Math.max(0, Math.floor(Number(params.page)) || 0);
  const sort = params.sort === "newest" ? "newest" : "relevance";

  const href = (overrides: { theme?: string; page?: number; sort?: string }) => {
    const q = new URLSearchParams();
    const t = overrides.theme ?? theme?.slug;
    const s = overrides.sort ?? sort;
    const p = overrides.page ?? 0;
    if (t) q.set("theme", t);
    if (s !== "relevance") q.set("sort", s);
    if (p > 0) q.set("page", String(p));
    return `/discover${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Découvrir</h1>
      <p className="mt-1 text-sm text-muted">Explore les livres par grand thème, puis ajoute ceux qui te tentent.</p>

      <nav aria-label="Thèmes" className="mt-6 flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <Link
            key={t.slug}
            href={href({ theme: t.slug, page: 0 })}
            title={t.description}
            className={`rounded-full px-3 py-1 text-sm transition ${
              theme?.slug === t.slug
                ? "bg-accent text-accent-foreground"
                : "border border-line bg-white text-muted hover:bg-soft hover:text-accent-strong"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!theme ? (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <Link
              key={t.slug}
              href={href({ theme: t.slug, page: 0 })}
              className="rounded-xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent"
            >
              <p className="font-semibold">{t.label}</p>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{theme.label}</h2>
              <p className="text-sm text-muted">{theme.description}</p>
            </div>
            {!theme.filter && (
              <div className="flex overflow-hidden rounded-lg border border-line text-sm">
                {(["relevance", "newest"] as const).map((s) => (
                  <Link
                    key={s}
                    href={href({ sort: s, page: 0 })}
                    className={`px-3 py-1.5 ${sort === s ? "bg-soft font-medium text-accent-strong" : "text-muted hover:bg-soft/60"}`}
                  >
                    {s === "relevance" ? "Pertinence" : "Nouveautés"}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <Suspense
              key={`${theme.slug}|${sort}|${page}`}
              fallback={<p className="text-sm text-muted">Recherche de livres…</p>}
            >
              <ThemeResults
                slug={theme.slug}
                page={page}
                sort={sort}
                userId={user.id}
                prevHref={page > 0 ? href({ page: page - 1 }) : null}
                nextHref={href({ page: page + 1 })}
              />
            </Suspense>
          </div>
        </section>
      )}
    </main>
  );
}

async function ThemeResults({
  slug,
  page,
  sort,
  userId,
  prevHref,
  nextHref,
}: {
  slug: string;
  page: number;
  sort: "relevance" | "newest";
  userId: string;
  prevHref: string | null;
  nextHref: string;
}) {
  const theme = findTheme(slug)!;
  const result = await searchByTheme(theme, { page, orderBy: sort });
  return (
    <>
      <ExternalWorks
        search={Promise.resolve(result)}
        userId={userId}
        emptyLabel="Rien de nouveau sur cette page : tu as peut-être déjà tout ce qui remontait."
      />
      <div className="mt-6 flex justify-between text-sm">
        {prevHref ? (
          <Link href={prevHref} className="btn-ghost">
            ← Page précédente
          </Link>
        ) : (
          <span />
        )}
        {result.hasMore && (
          <Link href={nextHref} className="btn-ghost">
            Page suivante →
          </Link>
        )}
      </div>
    </>
  );
}
