import type { BookCandidate } from "@/types/book";
import { guessCategoryFromSignals, type CategorySignals } from "./category";
import { fetchWithRetry } from "./http";
import { cleanIsbn, isbn10to13, parseSeriesFromTitle } from "./utils";

/**
 * Open Library — gratuite, sans clé. Source de secours (et de couvertures) quand
 * Google Books est indisponible ou ne trouve rien.
 * Doc : https://openlibrary.org/dev/docs/api/search
 */
const SEARCH_URL = "https://openlibrary.org/search.json";

type OpenLibraryDoc = {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
  subject?: string[];
};

function docToCandidate(doc: OpenLibraryDoc): BookCandidate | null {
  if (!doc.title) return null;

  const isbns = (doc.isbn ?? []).map(cleanIsbn).filter((i): i is string => !!i);
  const isbn13 = isbns.find((i) => i.length === 13 && /^97[89]/.test(i)) ?? null;
  const isbn10 = isbns.find((i) => i.length === 10) ?? null;
  const finalIsbn13 = isbn13 ?? (isbn10 ? isbn10to13(isbn10) : null);
  if (!finalIsbn13) return null; // sans ISBN, impossible de retrouver l'édition ensuite

  const fullTitle = doc.subtitle ? `${doc.title} - ${doc.subtitle}` : doc.title;
  const parsed = parseSeriesFromTitle(doc.title) ?? parseSeriesFromTitle(fullTitle);
  const publisher = doc.publisher?.[0] ?? null;

  const signals: CategorySignals = {
    googleCategories: (doc.subject ?? []).slice(0, 12),
    publisher,
    pageCount: doc.number_of_pages_median ?? null,
    title: fullTitle,
    description: null,
  };
  const guess = guessCategoryFromSignals(signals);

  return {
    source: "openlibrary",
    google_books_id: null,
    bnf_ark: null,
    title: parsed?.rest ?? doc.title,
    subtitle: parsed ? null : (doc.subtitle ?? null),
    description: null,
    category: guess.category,
    category_reasons: guess.reasons,
    category_signals: signals,
    series_title: parsed?.series ?? null,
    volume_number: parsed?.volume ?? null,
    isbn10,
    isbn13: finalIsbn13,
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    publisher,
    published_date: doc.first_publish_year ? String(doc.first_publish_year) : null,
    page_count: doc.number_of_pages_median ?? null,
    language: doc.language?.[0] ?? null,
    contributors: (doc.author_name ?? []).map((name) => ({ name, role: "author" as const })),
  };
}

export async function searchOpenLibrary(
  query: string,
  { isbn, limit = 20 }: { isbn?: string | null; limit?: number } = {}
): Promise<BookCandidate[]> {
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : `${query} language:fre`,
    limit: String(limit),
    fields:
      "key,title,subtitle,author_name,first_publish_year,isbn,cover_i,publisher,language,number_of_pages_median,subject",
  });
  const response = await fetchWithRetry(`${SEARCH_URL}?${params}`, {
    revalidate: 24 * 3600,
    label: "Open Library",
    timeoutMs: 10000,
  });
  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map(docToCandidate).filter((c): c is BookCandidate => c !== null);
}
