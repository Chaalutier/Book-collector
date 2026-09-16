import { supabase } from "../lib/supabase";
import BookSection from "./BookSection";

export default async function Home() {

  //Récupération du nombre de livres présents en base
  const {count } = await supabase
    .from("books")
    .select("*", { count: "exact" });

  const bookCount = count ?? 0;

  //Récupération du détail des livres
  const { data: books } = await supabase
  .from("books")
  .select("*")
  .order("created_at", { ascending: false });

  console.log(books);

  return (
    <main>
      <h1>Book Collector</h1>
      <p>Ma bibliothèque de livres.</p>

      <BookSection books={books} />
    </main>
  );
}