import { suggestCatalog } from "@/lib/catalog";
import { createClient } from "@/lib/server";

/** Autocomplétion de la recherche : GET /api/suggest?q=hunter x hun → 5 livres */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json([], { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.slice(0, 200) ?? "";
  try {
    return Response.json(await suggestCatalog(q));
  } catch (error) {
    console.error("Suggestions :", error);
    return Response.json([]);
  }
}
