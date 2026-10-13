import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";
import { getWishlist, groupWishlist, type WishItem } from "@/lib/wishlist";
import WishlistView from "./WishlistView";

export const metadata = { title: "Wishlist · Bouck" };

export default async function WishlistPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  let items: WishItem[];
  try {
    items = await getWishlist(supabase, user.id);
  } catch (error) {
    console.error("wishlist :", error);
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p>Impossible de charger ta wishlist pour le moment. Réessaie dans un instant.</p>
      </main>
    );
  }

  const wanted = items.filter((i) => i.status === "wishlist");
  const ordered = items.filter((i) => i.status === "ordered");
  const authorsWithoutOrigin = [
    ...new Set(
      items.filter((i) => !i.origin || i.originGuess).flatMap((i) => i.authors.map((a) => a.id))
    ),
  ];

  return (
    <WishlistView
      wanted={groupWishlist(wanted)}
      ordered={groupWishlist(ordered)}
      generatedAt={new Date().toISOString()}
      authorsWithoutOrigin={authorsWithoutOrigin}
    />
  );
}
