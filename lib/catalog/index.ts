import type { BookCandidate } from "@/types/book";
import { findBnfByIsbn, searchBnf, searchBnfByAuthor, searchBnfByPublisher } from "./bnf";
import { guessCategoryFromSignals, mergeSignals } from "./category";
import { searchGoogleBooks } from "./google-books";
import type { Theme } from "./themes";
import { looksLikeIsbn, normalizeTitle } from "./utils";

export type CatalogSearchResult = {
  results: BookCandidate[];
  warnings: string[];
};

function openLibraryCover(isbn: string | null): string | null {
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null;
}

/**
 * Recherche : Google Books en priorité (couvertures, pertinence),
 * BnF en secours (ou en complément pour une recherche par ISBN).
 */
export async function searchCatalog(query: string): Promise<CatalogSearchResult> {
  const q = query.trim();
  if (!q) return { results: [], warnings: [] };

  const isbn = looksLikeIsbn(q);
  const warnings: string[] = [];

  const [google, bnf] = await Promise.allSettled([
    searchGoogleBooks(q, { isbn }),
    // Pour un ISBN, la BnF donne souvent de meilleures infos (série, tome...)
    isbn ? findBnfByIsbn(isbn).then((r) => (r ? [r] : [])) : Promise.resolve([]),
  ]);

  let results: BookCandidate[] = google.status === "fulfilled" ? google.value : [];
  if (google.status === "rejected") {
    console.error("Google Books :", google.reason);
    warnings.push("Google Books est indisponible pour le moment, résultats issus de la BnF.");
  }

  if (isbn && bnf.status === "fulfilled" && bnf.value.length > 0) {
    const fromBnf = bnf.value[0];
    results =
      results.length > 0
        ? results.map((r, i) => (i === 0 ? mergeCandidates(r, fromBnf) : r))
        : [{ ...fromBnf, cover_url: openLibraryCover(fromBnf.isbn13) }];
  }

  // Rien chez Google ? On tente la BnF en plein texte
  if (results.length === 0 && !isbn) {
    try {
      const fromBnf = await searchBnf(q);
      results = fromBnf.map((r) => ({ ...r, cover_url: openLibraryCover(r.isbn13) }));
    } catch (error) {
      console.error("BnF :", error);
      warnings.push("La BnF est indisponible pour le moment.");
    }
  }

  return { results: sortBySeries(dedupe(results), q), warnings };
}

function nameTokens(value: string): string[] {
  return normalizeTitle(value.replace(/,/g, " ")).split(/\s+/).filter(Boolean);
}

/** « Eiichiro Oda » ↔ « Oda, Eiichiro » : tous les mots du nom recherché sont dans celui du contributeur */
export function sameAuthor(wanted: string, candidateName: string): boolean {
  const w = nameTokens(wanted);
  const c = new Set(nameTokens(candidateName));
  return w.length > 0 && w.every((t) => c.has(t));
}

/**
 * Œuvres d'un auteur : Google Books (`inauthor:`) + index auteur de la BnF.
 * On ne garde que les livres où l'auteur figure vraiment parmi les contributeurs.
 */
export async function searchByAuthor(name: string): Promise<CatalogSearchResult> {
  const author = name.trim();
  if (!author) return { results: [], warnings: [] };
  const warnings: string[] = [];

  const [google, bnf] = await Promise.allSettled([
    searchGoogleBooks(`inauthor:"${author.replace(/"/g, " ")}"`, { maxResults: 40 }),
    searchBnfByAuthor(author),
  ]);

  let results: BookCandidate[] = [];
  if (google.status === "fulfilled") results = results.concat(google.value);
  else {
    console.error("Google Books :", google.reason);
    warnings.push("Google Books est indisponible, résultats partiels.");
  }
  if (bnf.status === "fulfilled") {
    results = results.concat(bnf.value.map((r) => ({ ...r, cover_url: openLibraryCover(r.isbn13) })));
  } else {
    console.error("BnF :", bnf.reason);
    warnings.push("La BnF est indisponible, résultats partiels.");
  }

  results = results.filter((r) => r.contributors.some((c) => sameAuthor(author, c.name)));
  return { results: sortBySeries(dedupe(results), ""), warnings };
}

/**
 * Livres d'un éditeur : Google Books (`inpublisher:`, les plus récents d'abord) + BnF.
 * On ne garde que les livres dont l'éditeur correspond vraiment (collection incluse).
 */
export async function searchByPublisher(name: string): Promise<CatalogSearchResult> {
  const publisher = name.trim();
  if (!publisher) return { results: [], warnings: [] };
  const warnings: string[] = [];

  const [google, bnf] = await Promise.allSettled([
    searchGoogleBooks(`inpublisher:"${publisher.replace(/"/g, " ")}"`, { maxResults: 40, orderBy: "newest" }),
    searchBnfByPublisher(publisher),
  ]);

  let results: BookCandidate[] = [];
  if (google.status === "fulfilled") results = results.concat(google.value);
  else {
    console.error("Google Books :", google.reason);
    warnings.push("Google Books est indisponible, résultats partiels.");
  }
  if (bnf.status === "fulfilled") {
    results = results.concat(bnf.value.map((r) => ({ ...r, cover_url: openLibraryCover(r.isbn13) })));
  } else {
    console.error("BnF :", bnf.reason);
    warnings.push("La BnF est indisponible, résultats partiels.");
  }

  const wanted = nameTokens(publisher);
  results = results.filter((r) => {
    if (!r.publisher) return false;
    const have = new Set(nameTokens(r.publisher));
    return wanted.every((t) => have.has(t));
  });
  // Plus récents d'abord
  results = dedupe(results).sort((a, b) => (b.published_date ?? "").localeCompare(a.published_date ?? ""));
  return { results, warnings };
}

export const THEME_PAGE_SIZE = 20;

/**
 * Livres d'un grand thème, paginés par 20.
 * Essaie d'abord le sujet Google Books en français, puis toutes langues,
 * puis une recherche par mot-clé : un thème ne doit jamais rester vide.
 */
export async function searchByTheme(
  theme: Theme,
  { page = 0, orderBy = "relevance" }: { page?: number; orderBy?: "relevance" | "newest" } = {}
): Promise<CatalogSearchResult & { hasMore: boolean }> {
  const base = { maxResults: THEME_PAGE_SIZE, startIndex: page * THEME_PAGE_SIZE, orderBy, filter: theme.filter };
  const attempts = [
    { q: theme.query, lang: "fr" as string | null },
    { q: theme.query, lang: null },
    { q: theme.label, lang: "fr" as string | null },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const results = dedupe(await searchGoogleBooks(attempt.q, { ...base, lang: attempt.lang }));
      if (results.length > 0) {
        return { results, warnings: [], hasMore: results.length >= THEME_PAGE_SIZE - 5 };
      }
    } catch (error) {
      console.error(`Google Books (${attempt.q}) :`, error);
      lastError = error;
      // Quota / clé refusée : inutile d'insister avec les variantes
      break;
    }
  }

  return {
    results: [],
    warnings: lastError
      ? [`Google Books n'a pas répondu : ${lastError instanceof Error ? lastError.message : lastError}. Vérifie ta clé GOOGLE_BOOKS_API_KEY et le quota.`]
      : [],
    hasMore: false,
  };
}

/**
 * Complète un livre trouvé (Google) avec la notice BnF de la même édition :
 * série, n° de tome, rôles des auteurs, pages, éditeur.
 */
export async function enrichCandidate(candidate: BookCandidate): Promise<BookCandidate> {
  const isbn = candidate.isbn13 ?? candidate.isbn10;
  if (!isbn || candidate.source === "bnf") {
    return { ...candidate, cover_url: candidate.cover_url ?? openLibraryCover(candidate.isbn13) };
  }
  try {
    const fromBnf = await findBnfByIsbn(isbn);
    const merged = fromBnf ? mergeCandidates(candidate, fromBnf) : candidate;
    return { ...merged, cover_url: merged.cover_url ?? openLibraryCover(merged.isbn13) };
  } catch (error) {
    console.error("Enrichissement BnF impossible :", error);
    return candidate;
  }
}

/** Google pour l'image et le résumé, BnF pour les métadonnées françaises */
function mergeCandidates(google: BookCandidate, bnf: BookCandidate): BookCandidate {
  const bnfHasSeries = Boolean(bnf.series_title);
  const signals = mergeSignals(google.category_signals, bnf.category_signals);
  const merged = guessCategoryFromSignals(signals);
  return {
    ...google,
    bnf_ark: bnf.bnf_ark,
    title: bnfHasSeries ? bnf.title : google.title,
    subtitle: google.subtitle ?? bnf.subtitle,
    description: google.description ?? bnf.description,
    // La BnF reconnaît mieux les mangas (langue d'origine) ; Google reconnaît bien BD / romans
    // La catégorie est recalculée avec les indices des deux sources
    category: merged.category,
    category_reasons: merged.reasons,
    category_signals: signals,
    series_title: bnf.series_title ?? google.series_title,
    volume_number: bnf.volume_number ?? google.volume_number,
    isbn10: google.isbn10 ?? bnf.isbn10,
    isbn13: google.isbn13 ?? bnf.isbn13,
    publisher: bnf.publisher ?? google.publisher,
    published_date: google.published_date ?? bnf.published_date,
    page_count: bnf.page_count ?? google.page_count,
    language: google.language ?? bnf.language,
    contributors: bnf.contributors.length > 0 ? bnf.contributors : google.contributors,
  };
}

function dedupe(results: BookCandidate[]): BookCandidate[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.isbn13 ?? r.isbn10 ?? r.google_books_id ?? r.bnf_ark ?? r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Range les résultats : les tomes d'une même série sont regroupés et triés
 * par numéro (T.1, T.2, T.3…). Les séries gardent leur ordre de pertinence.
 * Si la recherche contient un numéro ("hunter x hunter 12"), ce tome passe en tête.
 */
function sortBySeries(results: BookCandidate[], query: string): BookCandidate[] {
  const wantedVolume = Number(query.match(/(?:^|\s|t\.?|tome\s*)(\d{1,3})\s*$/i)?.[1]);
  const groupKey = (c: BookCandidate, i: number) =>
    c.series_title ? `s:${normalizeTitle(c.series_title)}` : `b:${i}`;

  // Rang d'un groupe = position de son premier résultat
  const groupRank = new Map<string, number>();
  results.forEach((c, i) => {
    const key = groupKey(c, i);
    if (!groupRank.has(key)) groupRank.set(key, i);
  });

  return results
    .map((c, i) => ({ c, i, key: groupKey(c, i) }))
    .sort((a, b) => {
      if (Number.isFinite(wantedVolume)) {
        const aHit = a.c.volume_number === wantedVolume ? 0 : 1;
        const bHit = b.c.volume_number === wantedVolume ? 0 : 1;
        if (aHit !== bHit) return aHit - bHit;
      }
      const rank = groupRank.get(a.key)! - groupRank.get(b.key)!;
      if (rank !== 0) return rank;
      const va = a.c.volume_number ?? Number.POSITIVE_INFINITY;
      const vb = b.c.volume_number ?? Number.POSITIVE_INFINITY;
      return va - vb || a.i - b.i;
    })
    .map(({ c }) => c);
}
