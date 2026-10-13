import { searchCatalog, sameAuthor } from "@/lib/catalog";
import { normalizeTitle } from "@/lib/catalog/utils";
import type { Book, BookCandidate } from "@/types/book";

export type ScoredCandidate = BookCandidate & { score: number };

function tokens(value: string): Set<string> {
  return new Set(normalizeTitle(value).split(" ").filter((t) => t.length > 1));
}

/** Ressemblance entre deux libellés (0 à 1) : part de mots communs */
function overlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

/** Note de 0 à ~1,5 : titre (série incluse), auteur, tome */
export function scoreCandidate(book: Book, c: BookCandidate): number {
  const wanted = [book.series?.title, book.title].filter(Boolean).join(" ");
  const found = [c.series_title, c.title].filter(Boolean).join(" ");
  let score = overlap(wanted, found);

  const authors = book.contributors.map((x) => x.name);
  if (authors.length > 0 && c.contributors.length > 0) {
    if (authors.some((a) => c.contributors.some((x) => sameAuthor(a, x.name)))) score += 0.3;
    else score -= 0.3;
  }

  if (book.volume_number !== null && c.volume_number !== null) {
    score += Number(book.volume_number) === Number(c.volume_number) ? 0.2 : -0.5;
  }
  return score;
}

/** Cherche, dans les catalogues, les livres qui pourraient correspondre à cette fiche */
export async function findCandidatesForBook(book: Book, extraQuery?: string): Promise<ScoredCandidate[]> {
  const isbn = book.isbn13 ?? book.isbn10;
  const author = book.contributors[0]?.name ?? "";
  const volume = book.volume_number !== null ? ` ${Number(book.volume_number)}` : "";
  const query =
    extraQuery?.trim() ||
    (isbn && !book.series ? isbn : `${book.series ? book.series.title + volume : book.title} ${author}`.trim());

  const { results } = await searchCatalog(query);
  return results
    .map((c) => ({ ...c, score: scoreCandidate(book, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** Correspondance quasi certaine (pour la synchro en un clic), sinon null */
export async function autoMatchBook(book: Book): Promise<ScoredCandidate | null> {
  const [best] = await findCandidatesForBook(book);
  if (!best || best.score < 1.0) return null;
  if (!best.isbn13 && !best.isbn10 && !best.google_books_id) return null;
  return best;
}
