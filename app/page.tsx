import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/library";

export default async function Home() {
  // Connecté : direction la bibliothèque
  const user = await getCurrentUser();
  if (user) redirect("/library");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-4xl font-bold sm:text-5xl">Ta bibliothèque, enfin rangée.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Romans, essais, mangas et BD au même endroit. Suis tes séries tome par tome, ta pile à
        lire et ta wishlist.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary px-6 py-3 text-base">
          Créer mon compte
        </Link>
        <Link href="/login" className="btn-ghost px-6 py-3 text-base">
          Me connecter
        </Link>
      </div>
    </main>
  );
}
