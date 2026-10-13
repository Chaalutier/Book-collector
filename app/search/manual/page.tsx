import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";
import ManualForm from "./ManualForm";

export default async function ManualAddPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; to?: string; date?: string; back?: string }>;
}) {
  const { title = "", to, date = "", back } = await searchParams;
  const fromCalendar = back === "calendar";
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href={fromCalendar ? "/calendar" : "/search"} className="text-sm text-muted hover:text-foreground">
        ← {fromCalendar ? "Calendrier" : "Recherche"}
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{fromCalendar ? "Ajouter une sortie" : "Ajouter à la main"}</h1>
      <p className="mt-1 text-sm text-muted">
        Seul le titre est obligatoire. Tu pourras compléter la fiche plus tard : une fois le livre référencé
        (ISBN, couverture, date exacte…), un bouton la synchronise avec Google Books et la BnF.
      </p>
      <ManualForm
        initialTitle={title}
        initialStatus={to === "wishlist" ? "wishlist" : "to_read"}
        initialDate={date.slice(0, 40)}
        back={fromCalendar ? "calendar" : ""}
      />
    </main>
  );
}
