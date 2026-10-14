"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import type { ActionResult } from "./library";

function text(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+/g, " ").slice(0, max);
  return v || null;
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Enregistre la fiche d'une maison d'édition. Si le nom change, il est
 * corrigé sur tous les livres du catalogue (utile pour fusionner « Glenat » et « Glénat »).
 */
export async function savePublisher(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const original = text(formData.get("original"), 200);
  const name = text(formData.get("name"), 200);
  if (!original) return { ok: false, error: "Maison d'édition introuvable." };
  if (!name) return { ok: false, error: "Le nom est obligatoire." };

  const website = text(formData.get("website"), 300);
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    return { ok: false, error: "Le site doit commencer par http:// ou https://." };
  }
  const fields = {
    country: text(formData.get("country"), 60),
    parent_group: text(formData.get("parent_group"), 120),
    website,
    description: text(formData.get("description"), 2000),
  };

  // 1. Renommage éventuel sur tous les livres
  if (name !== original) {
    const { error } = await supabase
      .from("books")
      .update({ publisher: name })
      .ilike("publisher", escapeLike(original));
    if (error) {
      console.error("savePublisher (renommage) :", error);
      return { ok: false, error: "Impossible de renommer la maison d'édition." };
    }
  }

  // 2. Fiche : on récupère l'ancienne et celle du nouveau nom (fusion possible)
  const { data: oldRow, error: readError } = await supabase
    .from("publishers")
    .select("id")
    .ilike("name", escapeLike(original))
    .maybeSingle();
  if (readError) {
    console.error("savePublisher :", readError);
    return {
      ok: false,
      error:
        readError.code === "42P01" || readError.code === "PGRST205"
          ? "Exécute la migration 20261020000000_maisons_edition.sql dans Supabase."
          : "Enregistrement impossible.",
    };
  }
  const { data: targetRow } = await supabase
    .from("publishers")
    .select("id")
    .ilike("name", escapeLike(name))
    .maybeSingle();

  const targetId = (targetRow as { id: number } | null)?.id ?? (oldRow as { id: number } | null)?.id ?? null;
  const oldId = (oldRow as { id: number } | null)?.id ?? null;

  const result = targetId
    ? await supabase.from("publishers").update({ name, ...fields, updated_at: new Date().toISOString() }).eq("id", targetId)
    : await supabase.from("publishers").insert({ name, ...fields });
  if (result.error) {
    console.error("savePublisher (fiche) :", result.error);
    return { ok: false, error: "Enregistrement impossible." };
  }
  // Fusion : l'ancienne fiche devient inutile
  if (oldId && targetId && oldId !== targetId) await supabase.from("publishers").delete().eq("id", oldId);

  revalidatePath("/library", "layout");
  revalidatePath("/wishlist");
  redirect(`/publishers/${encodeURIComponent(name)}`);
}
