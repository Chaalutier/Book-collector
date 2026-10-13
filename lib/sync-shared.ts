import type { Book, BookCandidate } from "@/types/book";

/**
 * Fiche « provisoire » : ajoutée à la main, sans aucune référence d'un catalogue
 * (ni ISBN, ni Google Books, ni BnF). Elle peut être synchronisée plus tard.
 */
export function isProvisional(
  book: Pick<Book, "isbn10" | "isbn13"> & Partial<Pick<Book, "google_books_id" | "bnf_ark">>
): boolean {
  return !book.isbn13 && !book.isbn10 && !book.google_books_id && !book.bnf_ark;
}

/** Champs que l'on peut reprendre d'une API (une case à cocher chacun) */
export const SYNC_FIELDS = [
  "cover_url",
  "isbn",
  "published_date",
  "publisher",
  "page_count",
  "description",
  "contributors",
  "title",
] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];

export const SYNC_LABELS: Record<SyncField, string> = {
  cover_url: "Couverture",
  isbn: "ISBN et références",
  published_date: "Date de parution",
  publisher: "Éditeur",
  page_count: "Pages",
  description: "Résumé",
  contributors: "Auteurs",
  title: "Titre",
};

type LocalBook = Pick<
  Book,
  "title" | "cover_url" | "isbn10" | "isbn13" | "published_date" | "publisher" | "page_count" | "description" | "contributors"
> &
  Partial<Pick<Book, "google_books_id" | "bnf_ark">>;

const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : String(v));

/** Valeur actuelle (texte) d'un champ, null si vide */
export function localValue(book: LocalBook, field: SyncField): string | null {
  switch (field) {
    case "cover_url":
      return text(book.cover_url);
    case "isbn":
      return text(book.isbn13 ?? book.isbn10);
    case "published_date":
      return text(book.published_date);
    case "publisher":
      return text(book.publisher);
    case "page_count":
      return text(book.page_count);
    case "description":
      return text(book.description);
    case "contributors":
      return book.contributors.length ? book.contributors.map((c) => c.name).join(", ") : null;
    case "title":
      return text(book.title);
  }
}

/** Valeur proposée par l'API (texte), null si absente */
export function candidateValue(c: BookCandidate, field: SyncField): string | null {
  switch (field) {
    case "cover_url":
      return text(c.cover_url);
    case "isbn":
      return text(c.isbn13 ?? c.isbn10);
    case "published_date":
      return text(c.published_date);
    case "publisher":
      return text(c.publisher);
    case "page_count":
      return text(c.page_count);
    case "description":
      return text(c.description);
    case "contributors":
      return c.contributors.length ? c.contributors.map((x) => x.name).join(", ") : null;
    case "title":
      return text(c.title);
  }
}

/**
 * Champs cochés par défaut : tout ce qui est vide chez nous et connu de l'API ;
 * pour une fiche provisoire, la date et la couverture réelles remplacent aussi nos estimations.
 */
export function defaultSyncFields(book: LocalBook & { provisional?: boolean }, c: BookCandidate): SyncField[] {
  const provisional = book.provisional ?? isProvisional(book);
  return SYNC_FIELDS.filter((field) => {
    const next = candidateValue(c, field);
    if (!next) return false;
    const current = localValue(book, field);
    if (!current) return field !== "title";
    if (current === next) return false;
    return provisional && (field === "published_date" || field === "cover_url");
  });
}
