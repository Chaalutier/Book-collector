export const BOOK_CATEGORIES = ["novel", "essay", "manga", "comic"] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const READING_STATUSES = [
  "wishlist",
  "to_read",
  "reading",
  "read",
  "abandoned",
] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export const CONTRIBUTOR_ROLES = [
  "author",
  "scenarist",
  "artist",
  "colorist",
  "translator",
  "other",
] as const;
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number];

export type Contributor = {
  /** Id de l'auteur en base (absent pour les résultats de recherche) */
  id?: number;
  name: string;
  role: ContributorRole;
};

export type Series = {
  id: number;
  title: string;
  category: BookCategory;
  total_volumes: number | null;
  is_finished: boolean;
};

/** Fiche livre du catalogue partagé (table `books`) */
export type Book = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: BookCategory;
  series_id: number | null;
  volume_number: number | null;
  isbn10: string | null;
  isbn13: string | null;
  cover_url: string | null;
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  language: string | null;
  google_books_id: string | null;
  bnf_ark: string | null;
  created_at: string;
  series: Series | null;
  contributors: Contributor[];
};

/** Un livre dans la bibliothèque d'un utilisateur (table `user_books`) */
export type UserBook = {
  id: number;
  status: ReadingStatus;
  rating: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  book: Book;
};

/**
 * Livre trouvé via une API externe (Google Books / BnF), pas encore en base.
 * C'est aussi le format envoyé à la fonction SQL `add_book_to_library`.
 */
export type BookCandidate = {
  source: "google" | "bnf";
  /** Pourquoi cette catégorie a été choisie (affiché avant l'ajout) */
  category_reasons?: string[];
  /** Indices bruts servant à la détection (non enregistrés en base) */
  category_signals?: import("@/lib/catalog/category").CategorySignals;
  google_books_id: string | null;
  bnf_ark: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: BookCategory;
  series_title: string | null;
  volume_number: number | null;
  isbn10: string | null;
  isbn13: string | null;
  cover_url: string | null;
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  language: string | null;
  contributors: Contributor[];
};

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};
