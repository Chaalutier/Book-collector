"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BookCard from "@/app/components/BookCard";
import BookCover from "@/app/components/BookCover";
import { CATEGORY_LABELS, STATUS_LABELS, formatContributors, formatVolume } from "@/lib/labels";
import {
  BOOK_CATEGORIES,
  READING_STATUSES,
  type BookCategory,
  type ReadingStatus,
  type UserBook,
} from "@/types/book";

type StatusFilter = ReadingStatus | "all" | "owned";
type CategoryFilter = BookCategory | "all";
type ViewMode = "series" | "grid";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "owned", label: "Possédés" },
  ...READING_STATUSES.map((s) => ({ value: s as StatusFilter, label: STATUS_LABELS[s] })),
];

function matchesStatus(ub: UserBook, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "owned") return ub.status !== "wishlist";
  return ub.status === filter;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function bySeriesThenVolume(a: UserBook, b: UserBook) {
  const sa = a.book.series?.title ?? a.book.title;
  const sb = b.book.series?.title ?? b.book.title;
  return sa.localeCompare(sb, "fr") || (a.book.volume_number ?? 0) - (b.book.volume_number ?? 0);
}

export default function LibraryView({
  userBooks,
  initialStatus,
  initialCategory,
  initialQuery,
  initialView,
}: {
  userBooks: UserBook[];
  initialStatus?: string;
  initialCategory?: string;
  initialQuery?: string;
  initialView?: string;
}) {
  const [status, setStatus] = useState<StatusFilter>(
    STATUS_TABS.some((t) => t.value === initialStatus) ? (initialStatus as StatusFilter) : "all"
  );
  const [category, setCategory] = useState<CategoryFilter>(
    (BOOK_CATEGORIES as readonly string[]).includes(initialCategory ?? "")
      ? (initialCategory as BookCategory)
      : "all"
  );
  const [query, setQuery] = useState(initialQuery ?? "");
  const [view, setView] = useState<ViewMode>(initialView === "grid" ? "grid" : "series");

  // Garde les filtres dans l'URL (lien partageable, retour arrière)
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (category !== "all") params.set("category", category);
    if (query) params.set("q", query);
    if (view !== "series") params.set("view", view);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/library?${qs}` : "/library");
  }, [status, category, query, view]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return userBooks
      .filter((ub) => matchesStatus(ub, status))
      .filter((ub) => category === "all" || ub.book.category === category)
      .filter((ub) => {
        if (!q) return true;
        const haystack = normalize(
          [
            ub.book.title,
            ub.book.subtitle,
            ub.book.series?.title,
            ub.book.isbn13,
            ...ub.book.contributors.map((c) => c.name),
          ]
            .filter(Boolean)
            .join(" ")
        );
        return haystack.includes(q);
      })
      .sort(bySeriesThenVolume);
  }, [userBooks, status, category, query]);

  const counts = useMemo(() => {
    const base = userBooks.filter((ub) => category === "all" || ub.book.category === category);
    return Object.fromEntries(
      STATUS_TABS.map((t) => [t.value, base.filter((ub) => matchesStatus(ub, t.value)).length])
    ) as Record<StatusFilter, number>;
  }, [userBooks, category]);

  const { seriesGroups, standalone } = useMemo(() => {
    const groups = new Map<number, UserBook[]>();
    const alone: UserBook[] = [];
    for (const ub of filtered) {
      const id = ub.book.series?.id;
      if (id) groups.set(id, [...(groups.get(id) ?? []), ub]);
      else alone.push(ub);
    }
    return { seriesGroups: [...groups.values()], standalone: alone };
  }, [filtered]);

  return (
    <div className="mt-6">
      {/* Filtres */}
      <div className="flex flex-col gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                status === tab.value
                  ? "bg-accent text-accent-foreground"
                  : "border border-line bg-white text-muted hover:bg-soft hover:text-accent-strong"
              }`}
            >
              {tab.label} <span className="opacity-60">{counts[tab.value]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par titre, série, auteur, ISBN…"
            className="field max-w-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryFilter)}
            className="field w-auto"
            aria-label="Catégorie"
          >
            <option value="all">Toutes catégories</option>
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-line text-sm">
            {(["series", "grid"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`px-3 py-1.5 ${view === mode ? "bg-soft font-medium text-accent-strong" : "text-muted hover:bg-soft/60"}`}
              >
                {mode === "series" ? "Par série" : "Tous les tomes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-muted">Aucun livre ne correspond à ces filtres.</p>
      )}

      {view === "grid" ? (
        <BookGrid books={filtered} />
      ) : (
        <>
          {seriesGroups.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Séries</h2>
              <div className="book-grid">
                {seriesGroups.map((group) => (
                  <SeriesCard key={group[0].book.series!.id} books={group} />
                ))}
              </div>
            </section>
          )}
          {standalone.length > 0 && (
            <section className="mt-10">
              {seriesGroups.length > 0 && <h2 className="mb-4 text-lg font-semibold">One-shots</h2>}
              <BookGrid books={standalone} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookGrid({ books }: { books: UserBook[] }) {
  return (
    <div className="book-grid mt-6">
      {books.map((ub) => (
        <BookCard key={ub.id} userBook={ub} />
      ))}
    </div>
  );
}

function SeriesCard({ books }: { books: UserBook[] }) {
  const series = books[0].book.series!;
  const cover = books.find((b) => b.book.cover_url)?.book.cover_url ?? null;
  const read = books.filter((b) => b.status === "read").length;
  const owned = books.filter((b) => b.status !== "wishlist").length;
  const volumes = books.map((b) => b.book.volume_number).filter((v): v is number => v !== null);
  const last = volumes.length ? Math.max(...volumes) : null;
  const total = series.total_volumes ?? last;

  return (
    <Link href={`/library/series/${series.id}`} className="group flex flex-col gap-2">
      <div className="relative transition group-hover:-translate-y-0.5">
        {/* Effet "pile de tomes" */}
        <div className="absolute inset-0 translate-x-1 -translate-y-1 rounded-md bg-line" />
        <div className="relative">
          <BookCover src={cover} title={series.title} />
        </div>
        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white">
          {books.length} tome{books.length > 1 ? "s" : ""}
        </span>
      </div>
      <div>
        <p className="line-clamp-2 text-sm font-semibold group-hover:underline">{series.title}</p>
        <p className="truncate text-xs text-muted">
          {formatContributors(books[0].book.contributors)} · {CATEGORY_LABELS[series.category]}
        </p>
        <p className="text-xs text-muted">
          {owned} possédé{owned > 1 ? "s" : ""}
          {total ? ` / ${total}` : ""} · {read} lu{read > 1 ? "s" : ""}
          {last ? ` · jusqu'au ${formatVolume(last)}` : ""}
        </p>
      </div>
      {total ? (
        <div className="h-1 overflow-hidden rounded-full bg-soft" aria-label="Progression de lecture">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (read / total) * 100)}%` }} />
        </div>
      ) : null}
    </Link>
  );
}
