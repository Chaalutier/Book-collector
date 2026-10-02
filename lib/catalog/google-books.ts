import type { BookCandidate } from "@/types/book";
import { guessCategoryFromSignals, type CategorySignals } from "./category";
import {
  cleanIsbn,
  normalizeDate,
  parseSeriesFromTitle,
} from "./utils";

/**
 * Google Books API — gratuite.
 * Sans clé : quota partagé, souvent limité (erreurs 429).
 * Avec clé (GOOGLE_BOOKS_API_KEY dans .env.local) : 1 000 requêtes / jour gratuites.
 * Doc : https://developers.google.com/books/docs/v1/using
 */
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

type GoogleVolume = {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    mainCategory?: string;
    language?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
    };
    industryIdentifiers?: { type: string; identifier: string }[];
    seriesInfo?: {
      bookDisplayNumber?: string;
      volumeSeries?: { seriesId: string; orderNumber?: number }[];
    };
    printType?: string;
  };
};

type GoogleSearchResponse = {
  totalItems: number;
  items?: GoogleVolume[];
};

function coverFromGoogle(volume: GoogleVolume): string | null {
  const links = volume.volumeInfo.imageLinks;
  const url = links?.thumbnail ?? links?.smallThumbnail;
  if (!url) return null;
  return url.replace(/^http:/, "https:").replace("&edge=curl", "");
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/<[^>]+>/g, "").trim() || null;
}

export function googleVolumeToCandidate(volume: GoogleVolume): BookCandidate | null {
  const info = volume.volumeInfo;
  if (!info.title) return null;

  const ids = info.industryIdentifiers ?? [];
  const isbn13 = cleanIsbn(ids.find((i) => i.type === "ISBN_13")?.identifier);
  const isbn10 = cleanIsbn(ids.find((i) => i.type === "ISBN_10")?.identifier);

  // Série + tome depuis le titre ("One Piece - Tome 9")
  const fullTitle = info.subtitle ? `${info.title} - ${info.subtitle}` : info.title;
  const parsed = parseSeriesFromTitle(info.title) ?? parseSeriesFromTitle(fullTitle);
  const displayNumber = Number(info.seriesInfo?.bookDisplayNumber);

  const seriesTitle = parsed?.series ?? null;
  const volumeNumber =
    parsed?.volume ?? (Number.isFinite(displayNumber) && displayNumber > 0 ? displayNumber : null);

  const description = stripHtml(info.description);
  const signals: CategorySignals = {
    googleCategories: [...(info.categories ?? []), ...(info.mainCategory ? [info.mainCategory] : [])],
    publisher: info.publisher ?? null,
    pageCount: info.pageCount ?? null,
    title: `${info.title} ${info.subtitle ?? ""}`,
    description,
  };
  const guess = guessCategoryFromSignals(signals);

  return {
    source: "google",
    google_books_id: volume.id,
    bnf_ark: null,
    title: parsed?.rest ?? info.title,
    subtitle: parsed ? null : info.subtitle ?? null,
    description,
    category: guess.category,
    category_reasons: guess.reasons,
    category_signals: signals,
    series_title: seriesTitle,
    volume_number: volumeNumber,
    isbn10,
    isbn13,
    cover_url: coverFromGoogle(volume),
    publisher: info.publisher ?? null,
    published_date: normalizeDate(info.publishedDate),
    page_count: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
    language: info.language ?? null,
    contributors: (info.authors ?? []).map((name) => ({ name, role: "author" as const })),
  };
}

export async function searchGoogleBooks(
  query: string,
  {
    isbn,
    maxResults = 40,
    startIndex = 0,
    orderBy = "relevance",
    filter,
    lang,
    revalidate,
  }: {
    /** Met la réponse en cache (secondes) — utile pour les pages qui font beaucoup d'appels */
    revalidate?: number;
    /** Langue des éditions ("fr" par défaut, null = toutes) */
    lang?: string | null;
    isbn?: string | null;
    maxResults?: number;
    startIndex?: number;
    orderBy?: "relevance" | "newest";
    filter?: "ebooks" | "free-ebooks";
  } = {}
): Promise<BookCandidate[]> {
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : query,
    maxResults: String(maxResults),
    printType: "books",
    // Privilégie les éditions françaises sans exclure le reste
    langRestrict: isbn ? "" : lang === undefined ? "fr" : (lang ?? ""),
  });
  if (filter) params.set("filter", filter);
  if (startIndex > 0) params.set("startIndex", String(startIndex));
  if (!isbn) params.set("orderBy", orderBy);
  if (!params.get("langRestrict")) params.delete("langRestrict");

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);

  const response = await fetch(`${GOOGLE_BOOKS_URL}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    ...(revalidate ? { next: { revalidate } } : {}),
  });

  if (!response.ok) {
    throw new Error(`Google Books a répondu ${response.status}`);
  }

  const data = (await response.json()) as GoogleSearchResponse;
  return (data.items ?? [])
    .map(googleVolumeToCandidate)
    .filter((c): c is BookCandidate => c !== null);
}
