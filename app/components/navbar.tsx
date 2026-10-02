import Link from "next/link";
import { cache } from "react";
import { signOut } from "@/app/actions/profile";
import { getCurrentUser, getProfile } from "@/lib/library";
import { createClient } from "@/lib/server";
import Avatar from "./Avatar";
import BottomTabs from "./BottomTabs";

/** Données de la navigation, partagées entre la barre du haut et celle du bas (une seule requête) */
const getNavData = cache(async () => {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = user ? await getProfile(user.id, supabase) : null;
  // Nombre de livres en wishlist (pastille du bouton)
  const wishlistCount = user
    ? (
        await supabase
          .from("user_books")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "wishlist")
      ).count ?? 0
    : 0;
  return { user, profile, wishlistCount };
});

/** Onglets du bas, visibles sur mobile uniquement */
export async function MobileNav() {
  const { user, wishlistCount } = await getNavData();
  return user ? <BottomTabs wishlistCount={wishlistCount} /> : null;
}

export default async function Navbar() {
  const { user, profile, wishlistCount } = await getNavData();

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={user ? "/library" : "/"} className="text-lg font-bold">
          📚 Bouck
        </Link>

        {user ? (
          <Link href="/profile" aria-label="Mon profil" className="md:hidden">
            <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? user.email ?? "?"} size={32} />
          </Link>
        ) : null}

        <div className={`items-center gap-4 text-sm ${user ? "hidden md:flex" : "flex"}`}>
          {user ? (
            <>
              <Link href="/library" className="hover:text-accent-strong">
                Ma bibliothèque
              </Link>
              <Link
                href="/library?status=wishlist"
                title="Ma wishlist"
                className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 hover:border-accent hover:text-accent-strong"
              >
                <span aria-hidden>♡</span>
                <span className="hidden sm:inline">Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="rounded-full bg-[#f6e4e4] px-1.5 text-xs font-medium text-[#8a4848] tabular-nums">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link href="/discover" className="hover:text-accent-strong">
                Découvrir
              </Link>
              <Link href="/calendar" className="hover:text-accent-strong">
                Calendrier
              </Link>
              <Link href="/search" className="hover:text-accent-strong">
                Ajouter
              </Link>
              <Link href="/profile" className="flex items-center gap-2 hover:text-accent-strong">
                <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? user.email ?? "?"} size={28} />
                <span className="hidden sm:inline">{profile?.display_name ?? "Profil"}</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-muted hover:text-foreground">
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent-strong">
                Connexion
              </Link>
              <Link href="/register" className="btn-primary py-1.5">
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
