import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { searchBnf } from "@/lib/catalog/bnf";
import { searchGoogleBooks } from "@/lib/catalog/google-books";
import { normalizeTitle } from "@/lib/catalog/utils";
import type { BookCandidate, Contributor } from "@/types/book";

/**
 * bede.fr n'affiche pas les auteurs : on les complète via Google Books puis la BnF.
 * Un album est cherché une fois (même série = mêmes auteurs, on réutilise), et on réessaie
 * au bout de RETRY_DAYS si rien n'a été trouvé.
 */
const BUDGET_MS = 45_000;
const MAX_LOOKUPS = 40;
const RETRY_DAYS = 14;

type Row = {
  id: string;
  title: string;
  series_title: string | null;
  volume_number: number | null;
  publisher: string | null;
  release_date: string;
};

export type AuthorsResult = { ok: boolean; checked: number; filled: number; remaining: number; error?: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY manquante dans les variables d'environnement.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const words = (s: string) => normalizeTitle(s).split(" ").filter((w) => w.length > 1);

/** Le candidat correspond-il à l'album (série + tome, ou titre) ? */
function matches(row: Row, c: BookCandidate): boolean {
  if (c.contributors.length === 0) return false;
  if (row.series_title && c.series_title && normalizeTitle(c.series_title) === normalizeTitle(row.series_title)) {
    return row.volume_number === null || c.volume_number === null || c.volume_number === row.volume_number;
  }
  const a = new Set(words(row.title));
  const b = words(c.title);
  if (a.size === 0 || b.length === 0) return false;
  const common = b.filter((w) => a.has(w)).length;
  return common / Math.max(a.size, b.length) >= 0.7;
}

async function lookup(row: Row): Promise<Contributor[] | null> {
  const query = row.series_title
    ? `${row.series_title}${row.volume_number !== null ? ` tome ${row.volume_number}` : ""}`
    : row.title;
  const pools: (() => Promise<BookCandidate[]>)[] = [
    () => searchGoogleBooks(`${query} ${row.publisher ?? ""}`.trim(), { maxResults: 20 }),
    () => searchBnf(query, 15),
  ];
  for (const search of pools) {
    try {
      const found = (await search()).find((c) => matches(row, c));
      if (found) {
        const seen = new Set<string>();
        return found.contributors.filter((c) => !seen.has(c.name) && seen.add(c.name));
      }
    } catch (error) {
      console.warn("Recherche d'auteurs :", row.title, error);
    }
  }
  return null;
}

/** Complète les auteurs des sorties : prochaines d'abord, puis les plus récentes. */
export async function fillBdAuthors(): Promise<AuthorsResult> {
  try {
    const supabase = adminClient();
    const started = Date.now();
    const retryBefore = new Date(Date.now() - RETRY_DAYS * 86400_000).toISOString();

    const { data, error } = await supabase
      .from("bd_releases")
      .select("id, title, series_title, volume_number, publisher, release_date")
      .is("authors", null)
      .or(`authors_checked_at.is.null,authors_checked_at.lt.${retryBefore}`)
      .order("release_date", { ascending: true })
      .limit(1500);
    if (error) throw new Error(error.message);
    const todo = (data ?? []) as Row[];

    // Auteurs déjà connus par série (réutilisés pour les autres tomes)
    const bySeries = new Map<string, Contributor[]>();
    const { data: known } = await supabase
      .from("bd_releases")
      .select("series_title, authors")
      .not("authors", "is", null)
      .not("series_title", "is", null)
      .limit(5000);
    for (const k of (known ?? []) as { series_title: string; authors: Contributor[] }[]) {
      if (k.authors.length > 0) bySeries.set(normalizeTitle(k.series_title), k.authors);
    }

    const now = () => new Date().toISOString();
    let checked = 0;
    let filled = 0;
    let lookups = 0;

    for (const row of todo) {
      const key = row.series_title ? normalizeTitle(row.series_title) : null;
      let authors = key ? (bySeries.get(key) ?? null) : null;
      if (!authors) {
        if (lookups >= MAX_LOOKUPS || Date.now() - started > BUDGET_MS) break;
        lookups++;
        authors = await lookup(row);
        if (authors && key) bySeries.set(key, authors);
      }
      checked++;
      if (authors && authors.length > 0) filled++;
      const { error: upError } = await supabase
        .from("bd_releases")
        .update({ authors: authors && authors.length > 0 ? authors : null, authors_checked_at: now() })
        .eq("id", row.id);
      if (upError) throw new Error(upError.message);
    }

    return { ok: true, checked, filled, remaining: Math.max(0, todo.length - checked) };
  } catch (error) {
    console.error("Auteurs sorties BD :", error);
    return { ok: false, checked: 0, filled: 0, remaining: 0, error: error instanceof Error ? error.message : String(error) };
  }
}
