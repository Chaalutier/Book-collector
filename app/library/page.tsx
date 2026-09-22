import { supabase } from "../../lib/supabase";
import { redirect } from "next/navigation";

export default async function LibraryPage() {
    const {
        data: { user },
    } = await supabase.auth.getUser();

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

    if (error) {
        console.error(error);

        return <p>Impossible de charger votre pile à lire.</p>;
    }

    return (
        <main className="mx-auto max-w-6xl p-8">
            <h1 className="text-3xl font-bold">Ma pile à lire</h1>

            <p className="mt-2 text-gray-600">
                {userBooks.length} livre(s)
            </p>

            <pre className="mt-8 rounded-lg bg-gray-100 p-4">
                {JSON.stringify(userBooks, null, 2)}
            </pre>
        </main>
    );
}