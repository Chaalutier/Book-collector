import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEntry } from "@/lib/calendar";
import { normalizeTitle } from "@/lib/catalog/utils";
import type { BookCandidate, UserBook } from "@/types/book";

type Row = {
  id: string;
  release_date: string;
  title: string;
  series_title: string | null;
  volume_number: number | null;
  publisher: string | null;
  url: string | null;
  cover_url: string | null;
  last_seen_at: string;
};

export type BdCalendar = {
  entries: CalendarEntry[];
  /** Nombre de sorties qui concernent une série de la bibliothèque */
  followed: number;
  /** Date de la dernière mise à jour depuis bede.fr */
  updatedAt: string | null;
  /** Table absente ou illisible (migration pas encore exécutée) */
  error: string | null;
};

/** "Le Scorpion - Tome 15 - Le Secret du Scorpion" → "Le Secret du Scorpion" */
function volumeTitle(row: Row): string {
  if (!row.series_title || row.volume_number === null) return row.title;
  const rest = row.title
    .replace(/^.*?(?:\s*[-,:]\s*|\s+)(?:tome|t)\s?0*\d+\b/i, "")
    .replace(/^\s*[-,:]\s*/, "")
    .trim();
  return rest || row.title;
}

/** Sorties BD (bede.fr) au format du calendrier, croisées avec la bibliothèque de l'utilisateur */
export async function getBdCalendar(supabase: SupabaseClient, userBooks: UserBook[]): Promise<BdCalendar> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("bd_releases")
    .select("id, release_date, title, series_title, volume_number, publisher, url, cover_url, last_seen_at")
    .gte("release_date", today)
    .order("release_date")
    .order("title")
    .limit(2000);

  if (error) {
    console.error("Sorties BD :", error);
    return { entries: [], followed: 0, updatedAt: null, error: error.message };
  }
  const rows = (data ?? []) as Row[];

  // Séries de la bibliothèque (hors abandons), et tomes déjà présents par série
  const mySeries = new Map<string, { title: string; volumes: Map<number, UserBook> }>();
  for (const ub of userBooks) {
    const s = ub.book.series;
    if (!s || ub.status === "abandoned") continue;
    const key = normalizeTitle(s.title);
    const entry = mySeries.get(key) ?? { title: s.title, volumes: new Map() };
    if (ub.book.volume_number !== null) entry.volumes.set(ub.book.volume_number, ub);
    mySeries.set(key, entry);
  }

  let followed = 0;
  const entries: CalendarEntry[] = rows.map((row) => {
    const series = row.series_title ? mySeries.get(normalizeTitle(row.series_title)) : undefined;
    const owned = series && row.volume_number !== null ? series.volumes.get(row.volume_number) : undefined;
    if (series) followed++;

    const base = { key: `bd:${row.id}`, date: row.release_date };
    if (owned) {
      return {
        ...base,
        reasons: [
          owned.status === "wishlist"
            ? { kind: "wishlist" as const, label: "Dans ta wishlist" }
            : { kind: "owned" as const, label: owned.status === "ordered" ? "Commandé" : "Déjà à toi" },
        ],
        userBook: owned,
        candidate: null,
      };
    }

    const candidate: BookCandidate = {
      source: "google",
      google_books_id: null,
      bnf_ark: null,
      title: volumeTitle(row),
      subtitle: null,
      description: null,
      category: "comic",
      series_title: series?.title ?? row.series_title,
      volume_number: row.volume_number,
      isbn10: null,
      isbn13: null,
      cover_url: row.cover_url,
      publisher: row.publisher,
      published_date: row.release_date,
      page_count: null,
      language: "fr",
      contributors: [],
    };
    return {
      ...base,
      reasons: series ? [{ kind: "series" as const, label: `Suite de ${series.title}` }] : [],
      userBook: null,
      candidate,
    };
  });

  const updatedAt = rows.reduce<string | null>((max, r) => (!max || r.last_seen_at > max ? r.last_seen_at : max), null);
  return { entries, followed, updatedAt, error: null };
}
