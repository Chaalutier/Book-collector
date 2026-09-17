import BookCard from "./BookCard";
import type { Book } from "@/types/book";

export default function BookSection({
  books,
}: {
  books: Book[];
}) {
  return (
    <section>
      <h2>Mes livres</h2>

      <p>Découvre, organise et garde une trace de tes lectures</p>

      {books.map((book) => ( <BookCard key={book.id} book={book} />) )}
    </section>
  );
}