import type { Book } from "@/types/book";

export default function BookCard({ book }: { book: Book }) {
  return (
    <div>
      {book.cover_url && (
        <img
          src={book.cover_url}
          alt={`Couverture de ${book.title}`}
          width={150}
        />
      )}

      <h3>Titre: {book.title}</h3>
      <p>Auteur: {book.author}</p>
      <p>Nombre de pages: {book.page_count ?? "Non renseigné"}</p>
    </div>
  );
}