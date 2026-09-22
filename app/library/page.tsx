import { createClient } from "../../lib/server";
import { redirect } from "next/navigation";
import BookCard from "../components/BookCard";
import type { Book } from "../../types/book";

export default async function LibraryPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    console.log("Utilisateur côté serveur :", user);

    if (!user) {
        redirect("/login");
    }

    const { data: userBooks, error } = await supabase
        .from("user_books")
        .select(`
      id,
      status,
      books (
        id,
        title,
        author,
        cover_url,
        isbn10,
        isbn13,
        publisher,
        published_at,
        page_count
      )
    `)
        .eq("user_id", user.id);

    console.log("Mes livres :", userBooks);
    console.log("Erreur :", error);

    if (error) {
        console.error(error);

        return <p>Impossible de charger votre pile à lire.</p>;
    }

    const books = userBooks.map((userBook) => userBook.books as unknown as Book);

    return (
        <main className="mx-auto max-w-6xl p-8">
            <h1 className="text-3xl font-bold">Ma pile à lire</h1>

            <p className="mt-2 text-gray-600">
                {userBooks.length} livre(s)
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {books.map((book) => (
                    <BookCard key={book.id} book={book} />
                ))}
            </div>
        </main>
    );
}