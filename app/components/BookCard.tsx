import type { Book } from "@/types/book";

export default function BookCard({ book }: { book: Book }) {
  return (
    <div className="rounded-lg border p-4">
      {book.cover_url && (
        <img
          src={book.cover_url}
          alt={`Couverture de ${book.title}`}
          width={150}
        />
      )}

      <h3 className="text-lg font-semibold">{book.title}</h3>
      <p className="text-gray-300">Auteur: {book.author}</p>
      <p className="text-sm text-gray-200">Nombre de pages: {book.page_count ?? "Nombre de pages non renseigné"}</p>
    </div>
  );
}