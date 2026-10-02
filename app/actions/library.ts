"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enrichCandidate } from "@/lib/catalog";
import { findBnfByIsbn } from "@/lib/catalog/bnf";
import {
  guessCategoryFromSignals,
  mergeSignals,
  sanitizeSignals,
  type CategorySignals,
} from "@/lib/catalog/category";
import { searchGoogleBooks } from "@/lib/catalog/google-books";
import { matchExistingSeries, splitSeriesAndTitle } from "@/lib/catalog/utils";
import { createClient } from "@/lib/server";
import {
  BOOK_CATEGORIES,
  CONTRIBUTOR_ROLES,
  READING_STATUSES,
  type BookCandidate,
  type BookCategory,
  type ReadingStatus,
} from "@/types/book";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const isStatus = (v: unknown): v is ReadingStatus =>
  typeof v === "string" && (READING_STATUSES as readonly string[]).includes(v);
const isCategory = (v: unknown): v is BookCategory =>
  typeof v === "string" && (BOOK_CATEGORIES as readonly string[]).includes(v);

const str = (v: unknown, max = 500) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Nettoie un livre envoyé par le navigateur avant de l'écrire en base */
function sanitizeCandidate(input: BookCandidate): BookCandidate | null {
  const title = str(input?.title, 300);
  if (!title || !isCategory(input.category)) return null;
  return {
    source: input.source === "bnf" ? "bnf" : "google",
    category_reasons: Array.isArray(input.category_reasons)
      ? input.category_reasons.filter((r) => typeof r === "string").slice(0, 5).map((r) => r.slice(0, 200))
      : [],
    category_signals: sanitizeSignals(input.category_signals),
    google_books_id: str(input.google_books_id, 50),
    bnf_ark: str(input.bnf_ark, 100),
    title,
    subtitle: str(input.subtitle, 300),
    description: str(input.description, 5000),
    category: input.category,
    series_title: str(input.series_title, 200),
    volume_number: num(input.volume_number),
    isbn10: str(input.isbn10, 10),
    isbn13: str(input.isbn13, 13),
    cover_url: str(input.cover_url, 1000)?.startsWith("https://") ? str(input.cover_url, 1000) : null,
    publisher: str(input.publisher, 200),
    published_date: str(input.published_date, 10),
    page_count: num(input.page_count),
    language: str(input.language, 10),
    contributors: (Array.isArray(input.contributors) ? input.contributors : [])
      .slice(0, 20)
      .map((c) => ({
        name: str(c?.name, 200) ?? "",
        role: (CONTRIBUTOR_ROLES as readonly string[]).includes(c?.role) ? c.role : "other",
      }))
      .filter((c) => c.name),
  };
}

/**
 * Étape 1 de l'ajout : complète le livre avec la BnF (série, tome, auteurs)
 * pour que l'utilisateur vérifie avant d'enregistrer.
 */
export async function previewBook(candidate: BookCandidate): Promise<ActionResult<BookCandidate>> {
  const clean = sanitizeCandidate(candidate);
  if (!clean) return { ok: false, error: "Livre invalide." };
  const enriched = await enrichCandidate(clean);
  const supabase = await createClient();
  return { ok: true, data: await alignWithExistingSeries(supabase, enriched) };
}

/**
 * Évite les doublons de séries : réutilise le nom d'une série déjà en base
 * ("One piece" -> "One Piece", "Dungeon Crawler Carl : L'Oeil…" -> "Dungeon Crawler Carl").
 */
async function alignWithExistingSeries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidate: BookCandidate
): Promise<BookCandidate> {
  const { data } = await supabase.from("series").select("title").eq("category", candidate.category);
  const existing = ((data ?? []) as { title: string }[]).map((s) => s.title);
  if (existing.length === 0) return candidate;

  if (candidate.series_title) {
    const match = matchExistingSeries(candidate.series_title, existing);
    if (!match) return candidate;
    const split = splitSeriesAndTitle(candidate.series_title);
    const looksLikeVolumeLabel = /^(tome|t\.|vol)/i.test(candidate.title);
    return {
      ...candidate,
      series_title: match,
      // Le sous-titre de l'ancienne "série" est en fait le titre du tome
      title: split && looksLikeVolumeLabel ? split.title : candidate.title,
    };
  }

  // Pas de série détectée, mais un titre "Série : Titre du tome" connu
  const split = splitSeriesAndTitle(candidate.title);
  const match = split ? matchExistingSeries(split.series, existing) : null;
  return match && split ? { ...candidate, series_title: match, title: split.title } : candidate;
}

/** Étape 2 : enregistre le livre (catalogue + bibliothèque) */
export async function addBook(
  candidate: BookCandidate,
  status: ReadingStatus
): Promise<ActionResult<{ userBookId: number; alreadyInLibrary: boolean }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Connecte-toi pour ajouter des livres." };

  const clean = sanitizeCandidate(candidate);
  if (!clean) return { ok: false, error: "Livre invalide." };
  if (!isStatus(status)) return { ok: false, error: "Statut invalide." };

  const aligned = await alignWithExistingSeries(supabase, clean);
  // Champs de travail non enregistrés en base
  const { source: _source, category_reasons: _reasons, category_signals: _signals, ...payload } = aligned;
  void _source;
  void _reasons;
  void _signals;

  const { data: row, error } = await supabase
    .rpc("add_book_to_library", { p_book: payload, p_status: status })
    .single();
  const data = row as { user_book_id: number; book_id: number; already_in_library: boolean } | null;

  if (error || !data) {
    console.error("add_book_to_library :", error);
    return { ok: false, error: "Impossible d'ajouter ce livre." };
  }

  revalidatePath("/library", "layout");
  return {
    ok: true,
    data: { userBookId: data.user_book_id, alreadyInLibrary: data.already_in_library },
    message: data.already_in_library ? "Déjà dans ta bibliothèque." : "Ajouté !",
  };
}

/** Changement rapide de statut (depuis une carte) */
export async function updateStatus(userBookId: number, status: ReadingStatus): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (!isStatus(status)) return { ok: false, error: "Statut invalide." };

  // Dates de lecture renseignées automatiquement si vides
  const today = new Date().toISOString().slice(0, 10);
  const { data: current } = await supabase
    .from("user_books")
    .select("started_at, finished_at")
    .eq("id", userBookId)
    .eq("user_id", user.id)
    .maybeSingle();

  const patch: Record<string, unknown> = { status };
  if (status === "reading" && !current?.started_at) patch.started_at = today;
  if (status === "read" && !current?.finished_at) patch.finished_at = today;

  const { error } = await supabase
    .from("user_books")
    .update(patch)
    .eq("id", userBookId)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return { ok: false, error: "Impossible de changer le statut." };
  }

  revalidatePath("/library", "layout");
  return { ok: true };
}

/** Formulaire de la fiche : statut, note, notes perso, dates */
export async function updateUserBook(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const id = Number(formData.get("id"));
  const status = formData.get("status");
  const rating = num(formData.get("rating"));
  if (!isStatus(status)) return { ok: false, error: "Statut invalide." };

  const { error } = await supabase
    .from("user_books")
    .update({
      status,
      rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
      notes: str(formData.get("notes"), 5000),
      started_at: str(formData.get("started_at"), 10),
      finished_at: str(formData.get("finished_at"), 10),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return { ok: false, error: "Enregistrement impossible." };
  }

  revalidatePath("/library", "layout");
  return { ok: true, message: "Enregistré." };
}

/** Correction de la fiche livre : catégorie, série, tome */
export async function updateBookInfo(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const bookId = Number(formData.get("book_id"));
  const title = str(formData.get("title"), 300);
  const category = formData.get("category");
  const seriesTitle = str(formData.get("series_title"), 200);
  const volume = num(formData.get("volume_number"));
  if (!isCategory(category)) return { ok: false, error: "Catégorie invalide." };
  if (!title) return { ok: false, error: "Le titre est obligatoire." };

  // L'utilisateur doit avoir ce livre dans sa bibliothèque
  const { data: owned } = await supabase
    .from("user_books")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();
  if (!owned) return { ok: false, error: "Livre introuvable dans ta bibliothèque." };

  let seriesId: number | null = null;
  if (seriesTitle) {
    const { data: existing } = await supabase
      .from("series")
      .select("id")
      .ilike("title", seriesTitle.replace(/[%_\\]/g, "\\$&"))
      .eq("category", category)
      .maybeSingle();

    if (existing) {
      seriesId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("series")
        .insert({ title: seriesTitle, category })
        .select("id")
        .single();
      if (error) {
        console.error(error);
        return { ok: false, error: "Impossible de créer la série." };
      }
      seriesId = created.id;
    }
  }

  const { error } = await supabase
    .from("books")
    .update({ title, category, series_id: seriesId, volume_number: seriesId ? volume : null })
    .eq("id", bookId);

  if (error) {
    console.error(error);
    return { ok: false, error: "Enregistrement impossible." };
  }

  revalidatePath("/library", "layout");
  return { ok: true, message: "Fiche mise à jour." };
}

/** Retire un livre de la bibliothèque (le catalogue partagé est conservé) */
export async function removeFromLibrary(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const id = Number(formData.get("id"));
  const { error } = await supabase.from("user_books").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error(error);
    throw new Error("Suppression impossible.");
  }

  revalidatePath("/library", "layout");
  redirect("/library");
}

/** Mise à jour d'une série (nombre de tomes parus, terminée ou non) */
export async function updateSeries(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const id = Number(formData.get("id"));
  const title = str(formData.get("title"), 200);
  const total = num(formData.get("total_volumes"));
  if (!title) return { ok: false, error: "Le nom de la série est obligatoire." };
  const { error } = await supabase
    .from("series")
    .update({
      title,
      total_volumes: total && total > 0 ? Math.round(total) : null,
      is_finished: formData.get("is_finished") === "on",
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    if (error.code === "23505") {
      return { ok: false, error: "Une série porte déjà ce nom : utilise plutôt la fusion." };
    }
    return { ok: false, error: "Enregistrement impossible." };
  }

  revalidatePath("/library", "layout");
  return { ok: true, message: "Série mise à jour." };
}

/** Fusionne une série (doublon) dans une autre, puis ouvre la série cible */
export async function mergeSeries(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const source = Number(formData.get("source_id"));
  const target = Number(formData.get("target_id"));
  if (!source || !target || source === target) return;

  const { error } = await supabase.rpc("merge_series", { p_source: source, p_target: target });
  if (error) {
    console.error("merge_series :", error);
    throw new Error("Fusion impossible. As-tu exécuté la migration de fusion ?");
  }

  revalidatePath("/library", "layout");
  redirect(`/library/series/${target}`);
}

/**
 * Relance la détection automatique de la catégorie d'un livre déjà en base
 * (Google Books + BnF par ISBN). Ne modifie rien : renvoie une suggestion.
 */
export async function detectCategory(
  bookId: number
): Promise<ActionResult<{ category: BookCategory; reasons: string[] }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: book } = await supabase
    .from("books")
    .select("title, isbn13, isbn10, publisher, page_count, description")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return { ok: false, error: "Livre introuvable." };

  const isbn: string | null = book.isbn13 ?? book.isbn10;
  let signals: CategorySignals = {
    publisher: book.publisher,
    pageCount: book.page_count,
    title: book.title,
    description: book.description,
  };

  if (isbn) {
    const [google, bnf] = await Promise.allSettled([
      searchGoogleBooks("", { isbn, maxResults: 1 }),
      findBnfByIsbn(isbn),
    ]);
    if (google.status === "fulfilled" && google.value[0]) {
      signals = mergeSignals(signals, google.value[0].category_signals);
    }
    if (bnf.status === "fulfilled" && bnf.value) {
      signals = mergeSignals(signals, bnf.value.category_signals);
    }
  }

  const guess = guessCategoryFromSignals(signals);
  return { ok: true, data: { category: guess.category, reasons: guess.reasons } };
}
