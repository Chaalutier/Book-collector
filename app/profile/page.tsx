import { redirect } from "next/navigation";
import { getCurrentUser, getProfile, getUserLibrary } from "@/lib/library";
import { createClient } from "@/lib/server";
import LibraryStats from "@/app/components/LibraryStats";
import { signOut } from "@/app/actions/profile";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const [profile, library] = await Promise.all([
    getProfile(user.id, supabase),
    getUserLibrary(supabase, user.id).catch(() => []),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Mon profil</h1>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <ProfileForm
          userId={user.id}
          email={user.email ?? ""}
          profile={profile ?? { id: user.id, display_name: null, bio: null, avatar_url: null }}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Mes stats</h2>
        <LibraryStats userBooks={library} />
      </section>

      {/* Sur mobile, la déconnexion n'est plus dans la barre du haut */}
      <form action={signOut} className="mt-8 md:hidden">
        <button type="submit" className="btn-ghost w-full">
          Déconnexion
        </button>
      </form>
    </main>
  );
}
