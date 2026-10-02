import { CATEGORY_LABELS } from "@/lib/labels";
import { BOOK_CATEGORIES, type UserBook } from "@/types/book";

/** Couleurs des catégories (roman, essai, manga, BD), accordées au thème */
const CATEGORY_COLORS = ["bg-[#6b9080]", "bg-[#a4c3b2]", "bg-[#d9b26f]", "bg-[#c98f8f]"];

/** Statistiques de la bibliothèque (page bibliothèque + profil) */
export default function LibraryStats({ userBooks }: { userBooks: UserBook[] }) {
  const year = new Date().getFullYear();
  const owned = userBooks.filter((ub) => ub.status !== "wishlist");
  const read = userBooks.filter((ub) => ub.status === "read");
  const readThisYear = read.filter((ub) => ub.finished_at?.startsWith(String(year))).length;
  const pagesRead = read.reduce((sum, ub) => sum + (ub.book.page_count ?? 0), 0);
  const series = new Set(userBooks.map((ub) => ub.book.series?.id).filter(Boolean)).size;
  const readPct = owned.length ? Math.round((owned.filter((ub) => ub.status === "read").length / owned.length) * 100) : 0;

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Possédés", value: String(owned.length), hint: `${series} série${series > 1 ? "s" : ""}` },
    { label: "Lus", value: String(read.length), hint: `${readPct} % de ma bibliothèque` },
    { label: "En cours", value: String(userBooks.filter((ub) => ub.status === "reading").length) },
    { label: "À lire", value: String(userBooks.filter((ub) => ub.status === "to_read").length) },
    { label: "Wishlist", value: String(userBooks.length - owned.length) },
    { label: `Lus en ${year}`, value: String(readThisYear) },
    { label: "Pages lues", value: pagesRead.toLocaleString("fr-FR") },
  ];

  const byCategory = BOOK_CATEGORIES.map((c) => ({
    category: c,
    count: owned.filter((ub) => ub.book.category === c).length,
  }));
  const total = owned.length || 1;

  return (
    <section aria-label="Statistiques" className="rounded-xl border border-line bg-card p-4">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => (
          <div key={t.label}>
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{t.value}</dd>
            {t.hint && <dd className="text-[11px] text-muted">{t.hint}</dd>}
          </div>
        ))}
      </dl>

      {owned.length > 0 && (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-soft" aria-hidden>
            {byCategory.map(({ category, count }, i) =>
              count > 0 ? (
                <div
                  key={category}
                  className={CATEGORY_COLORS[i]}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {byCategory.map(({ category, count }, i) => (
              <li key={category} className="flex items-center gap-1.5">
                <span
                  className={`inline-block size-2 rounded-full ${CATEGORY_COLORS[i]}`}
                />
                {CATEGORY_LABELS[category]} <span className="text-foreground tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
