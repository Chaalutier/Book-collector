import { suggestCatalog } from "@/lib/catalog";
import { BOOK_SELECT, mapBook } from "@/lib/library";
import { createClient } from "@/lib/server";

/** Autocomplétion de la recherche : GET /api/suggest?q=hunter x hun → 5 livres */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json([], { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (q.length < 3) return Response.json([]);

  // Catalogue partagé de l'app : chaque mot doit apparaître dans le titre
  let local = supabase.from("books").select(BOOK_SELECT).limit(30);
  for (const word of q.split(/\s+/)) local = local.ilike("title", `%${word.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await local;
  if (error) console.error("Suggestions (catalogue) :", error);
  const fromLibrary = (data ?? []).map((raw) => {
    const book = mapBook(raw as unknown as Parameters<typeof mapBook>[0]);
    return { ...book, series_title: book.series?.title ?? null };
  });

  try {
    return Response.json(await suggestCatalog(q, fromLibrary));
  } catch (error) {
    console.error("Suggestions :", error);
    return Response.json([]);
  }
}
