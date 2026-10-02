import { matchExistingSeries, normalizeTitle } from "@/lib/catalog/utils";
import { sameAuthor } from "@/lib/catalog";
import { searchGoogleBooks } from "@/lib/catalog/google-books";
import type { BookCandidate, UserBook } from "@/types/book";

export type CalendarReason = { kind: "series" | "wishlist" | "author"; label: string };

export type CalendarEntry = {
  key: string;
  /** "2026-11-04", "2026-11" ou "2027" */
  date: string;
  reasons: CalendarReason[];
  /** Livre déjà dans la wishlist */
  userBook: UserBook | null;
  /** Livre trouvé en ligne */
  candidate: BookCandidate | null;
};

export type CalendarResult = {
  entries: CalendarEntry[];
  tracked: { series: number; authors: number; wishlist: number };
  failures: number;
};

const CACHE_SECONDS = 6 * 3600;
const MAX_SERIES = 12;
const MAX_AUTHORS = 10;
const CONCURRENCY = 5;

/** La date est-elle à venir ? (et pas absurdement lointaine) */
export function isUpcoming(date: string | null | undefined, now = new Date()): boolean {
  if (!date) return false;
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  if (Number(date.slice(0, 4)) > year + 2) return false;
  if (date.length >= 10) return date >= today;
  if (date.length === 7) return date >= today.slice(0, 7);
  // Année seule : trop vague pour l'année en cours (souvent une date de parution passée)
  return Number(date) > year;
}

async function inPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (i < items.length) await worker(items[i++]);
    })
  );
}

export async function getCalendar(userBooks: UserBook[], owned: Map<string, number>): Promise<CalendarResult> {
  const entries = new Map<string, CalendarEntry>();
  let failures = 0;

  const addReason = (entry: CalendarEntry, reason: CalendarReason) => {
    if (!entry.reasons.some((r) => r.kind === reason.kind && r.label === reason.label)) entry.reasons.push(reason);
  };
  const keyOf = (c: BookCandidate) =>
    c.isbn13 ?? c.isbn10 ?? c.google_books_id ?? `${normalizeTitle(c.title)}|${c.volume_number ?? ""}`;
  const isOwned = (c: BookCandidate) => [c.isbn13, c.isbn10, c.google_books_id].some((k) => k && owned.has(k));

  const addCandidate = (c: BookCandidate, reason: CalendarReason) => {
    if (!isUpcoming(c.published_date) || isOwned(c) || !c.published_date) return;
    const key = keyOf(c);
    const existing = entries.get(key);
    if (existing) return addReason(existing, reason);
    entries.set(key, { key, date: c.published_date, reasons: [reason], userBook: null, candidate: c });
  };

  // 1. Wishlist : les dates sont déjà en base
  const wishlist = userBooks.filter((ub) => ub.status === "wishlist" && isUpcoming(ub.book.published_date));
  for (const ub of wishlist) {
    const key = `ub:${ub.id}`;
    entries.set(key, {
      key,
      date: ub.book.published_date!,
      reasons: [{ kind: "wishlist", label: "Dans ta wishlist" }],
      userBook: ub,
      candidate: null,
    });
  }

  // 2. Séries suivies : prochains tomes
  type SeriesTarget = { title: string; maxVolume: number; total: number | null };
  const series = new Map<number, SeriesTarget & { active: boolean }>();
  for (const ub of userBooks) {
    const s = ub.book.series;
    if (!s || s.is_finished) continue;
    const t = series.get(s.id) ?? { title: s.title, maxVolume: 0, total: s.total_volumes, active: false };
    t.maxVolume = Math.max(t.maxVolume, ub.book.volume_number ?? 0);
    if (ub.status !== "wishlist" && ub.status !== "abandoned") t.active = true;
    series.set(s.id, t);
  }
  const seriesTargets = [...series.values()]
    .filter((t) => t.active && !(t.total && t.maxVolume >= t.total))
    .slice(0, MAX_SERIES);

  // 3. Auteurs que je lis
  const authorCount = new Map<string, number>();
  for (const ub of userBooks) {
    if (ub.status === "wishlist" || ub.status === "abandoned") continue;
    for (const c of ub.book.contributors) {
      if (c.role === "author" || c.role === "scenarist" || c.role === "artist") {
        authorCount.set(c.name, (authorCount.get(c.name) ?? 0) + 1);
      }
    }
  }
  const authorTargets = [...authorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_AUTHORS)
    .map(([name]) => name);

  await Promise.all([
    inPool(seriesTargets, async (t) => {
      try {
        const results = await searchGoogleBooks(`intitle:"${t.title.replace(/"/g, " ")}"`, {
          orderBy: "newest",
          maxResults: 20,
          revalidate: CACHE_SECONDS,
        });
        for (const c of results) {
          if (!c.series_title || matchExistingSeries(c.series_title, [t.title]) === null) continue;
          if (c.volume_number === null || c.volume_number <= t.maxVolume) continue;
          addCandidate(c, { kind: "series", label: `Suite de ${t.title}` });
        }
      } catch (error) {
        failures++;
        console.error(`Calendrier (série ${t.title}) :`, error);
      }
    }),
    inPool(authorTargets, async (name) => {
      try {
        const results = await searchGoogleBooks(`inauthor:"${name.replace(/"/g, " ")}"`, {
          orderBy: "newest",
          maxResults: 20,
          revalidate: CACHE_SECONDS,
        });
        for (const c of results) {
          if (!c.contributors.some((x) => sameAuthor(name, x.name))) continue;
          addCandidate(c, { kind: "author", label: `Nouveau de ${name}` });
        }
      } catch (error) {
        failures++;
        console.error(`Calendrier (auteur ${name}) :`, error);
      }
    }),
  ]);

  return {
    entries: [...entries.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)),
    tracked: { series: seriesTargets.length, authors: authorTargets.length, wishlist: wishlist.length },
    failures,
  };
}
