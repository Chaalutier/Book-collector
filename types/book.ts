export type Book = {
  id: number;
  title: string;
  author: string;
  isbn10: string | null;
  isbn13: string | null;
  cover_url: string | null;
  publisher: string | null;
  published_at: string | null;
  page_count: number | null;
  created_at: string;
};