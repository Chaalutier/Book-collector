"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import type { ActionResult } from "./library";

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();

  if (displayName.length > 50) return { ok: false, error: "Nom affiché : 50 caractères maximum." };
  if (bio.length > 500) return { ok: false, error: "Description : 500 caractères maximum." };

  // La photo doit venir du dossier de l'utilisateur dans le bucket "avatars"
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (avatarUrl && !avatarUrl.startsWith(allowedPrefix)) {
    return { ok: false, error: "Photo invalide." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName || null,
    bio: bio || null,
    avatar_url: avatarUrl || null,
  });

  if (error) {
    console.error(error);
    return { ok: false, error: "Enregistrement impossible." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil mis à jour." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
