"use client";

import { useState } from "react";
import BookCard from "./BookCard";
import type { Book } from "../types/book";
import type { OpenLibraryBook } from "../types/open-library";
import { supabase } from "../lib/supabase";


export default function BookSection({ books }: { books: Book[] }) {
  const [search, setSearch] = useState("");

  const [searchResults, setSearchResults] = useState<OpenLibraryBook[]>([]);

  const getCoverUrl = (coverId?: number) => {
    if (!coverId) {
      return null;
    }

    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  };

  const toBook = (result: OpenLibraryBook) => {
    return {
      title: result.title,
      author: result.author_name?.[0] ?? "Auteur inconnu",
      isbn10: null,
      isbn13: null,
      cover_url: getCoverUrl(result.cover_i),
      publisher: null,
      published_at: result.first_publish_year
        ? `${result.first_publish_year}-01-01`
        : null,
      page_count: null,
    };
  };

  const addBook = async (result: OpenLibraryBook) => {
    const book = toBook(result);

    const { data, error } = await supabase
      .from("books")
      .insert(book)
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    console.log("Livre ajouté :", data);
  };

  const searchBooks = async () => {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(search)}`
    );

    const data = await response.json();

    setSearchResults(data.docs);

    console.log(toBook(data.docs[0]));
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(search.toLowerCase()) ||
      book.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section>
      <h2>Mes livres</h2>

      <p>Découvre, organise et garde une trace de tes lectures</p>

      <label htmlFor="site-search">Rechercher :</label>

      <input
        type="search"
        id="site-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <button onClick={searchBooks}>
        Rechercher sur Open Library
      </button>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {searchResults.map((result) => (
          <div
            key={result.key}
            className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex h-64 items-center justify-center bg-gray-100 p-4">
              {result.cover_i ? (
                <img
                  src={`https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg`}
                  alt={`Couverture de ${result.title}`}
                  className="h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-sm text-gray-400">
                  Pas de couverture
                </span>
              )}
            </div>

            <div className="p-4">
              <h3 className="line-clamp-2 text-lg font-semibold">
                {result.title}
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                {result.author_name?.[0] ?? "Auteur inconnu"}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                {result.first_publish_year ?? "Année inconnue"}
              </p>

              <button
                onClick={() => addBook(result)}
                className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Ajouter à ma bibliothèque
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredBooks.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}