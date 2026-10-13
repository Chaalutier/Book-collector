"use server";

import { revalidatePath } from "next/cache";
import { detectAuthorOrigin, isOrigin } from "@/lib/origin";
import { createClient } from "@/lib/server";
import type { ActionResult } from "./library";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Enregistre (ou efface avec null) l'origine d'un auteur */
export async function setAuthorOrigin(authorId: number, origin: string | null): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (origin !== null && !isOrigin(origin)) return { ok: false, error: "Origine invalide." };

  const { error } = await supabase.from("authors").update({ origin }).eq("id", authorId);
  if (error) {
    console.error("setAuthorOrigin :", error);
    return {
      ok: false,
      error: error.code === "42703" ? "Exécute la migration 20261018000000_origine_auteur.sql dans Supabase." : "Enregistrement impossible.",
    };
  }
  revalidatePath("/wishlist");
  revalidatePath(`/authors/${authorId}`);
  return { ok: true, message: "Origine enregistrée." };
}

/** Détecte l'origine de plusieurs auteurs (Wikidata), 12 au maximum par appel */
export async function detectOrigins(authorIds: number[]): Promise<ActionResult<{ found: number; missed: number }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const ids = [...new Set(authorIds.filter((n) => Number.isInteger(n)))].slice(0, 12);
  if (ids.length === 0) return { ok: true, data: { found: 0, missed: 0 } };

  const { data: authors, error } = await supabase.from("authors").select("id, name, origin").in("id", ids);
  if (error) {
    console.error("detectOrigins :", error);
    return { ok: false, error: "Exécute d'abord la migration 20261018000000_origine_auteur.sql dans Supabase." };
  }

  let found = 0;
  let missed = 0;
  const todo = (authors ?? []).filter((a: { origin: string | null }) => !a.origin) as { id: number; name: string }[];
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (a) => {
        try {
          const origin = await detectAuthorOrigin(a.name);
          if (!origin) return void missed++;
          const { error: updateError } = await supabase.from("authors").update({ origin }).eq("id", a.id);
          if (updateError) missed++;
          else found++;
        } catch (e) {
          console.error("Origine", a.name, e);
          missed++;
        }
      })
    );
  }

  revalidatePath("/wishlist");
  return { ok: true, data: { found, missed } };
}
