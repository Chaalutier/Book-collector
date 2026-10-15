import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { BEDE_BASE, parseBedePage, type BedeRelease } from "./parse";

/** Pages lues sur bede.fr (« bd », et éventuellement « manga », « comics ») */
const PAGES = ["bd"];
/** En dessous, on considère que la page a changé de structure : on ne touche à rien */
const MIN_EXPECTED = 20;
const USER_AGENT = "Bouck/1.0 (bibliotheque personnelle, avec l'accord de bede.fr)";

export type SyncResult = {
  ok: boolean;
  found: number;
  upserted: number;
  removed: number;
  firstDate: string | null;
  lastDate: string | null;
  error?: string;
};

/** Client Supabase avec la clé secrète : écrit dans `bd_releases` malgré la RLS. Serveur uniquement. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY manquante dans les variables d'environnement.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchPage(page: string): Promise<string> {
  const res = await fetch(`${BEDE_BASE}/${page}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${BEDE_BASE}/${page} a répondu ${res.status}`);
  return res.text();
}

export async function syncBdReleases(): Promise<SyncResult> {
  const empty = { found: 0, upserted: 0, removed: 0, firstDate: null, lastDate: null };
  try {
    const all: BedeRelease[] = [];
    for (const page of PAGES) all.push(...parseBedePage(await fetchPage(page), page));

    const today = new Date().toISOString().slice(0, 10);
    const byId = new Map<string, BedeRelease>();
    for (const r of all) if (r.date >= today && !byId.has(r.id)) byId.set(r.id, r);
    const releases = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));

    if (releases.length < MIN_EXPECTED) {
      return {
        ...empty,
        ok: false,
        found: releases.length,
        error: `Seulement ${releases.length} sorties trouvées : la page bede.fr a peut-être changé. Rien n'a été modifié.`,
      };
    }

    const supabase = adminClient();
    const now = new Date().toISOString();
    const rows = releases.map((r) => ({
      id: r.id,
      release_date: r.date,
      title: r.title,
      series_title: r.series_title,
      volume_number: r.volume_number,
      publisher: r.publisher,
      url: r.url,
      cover_url: r.cover_url,
      source_page: r.page,
      last_seen_at: now,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("bd_releases").upsert(rows.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
    }

    // Sorties à venir qui ont disparu de bede.fr (annulées / reportées sans date), et sorties passées depuis 2 mois
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const { count: gone, error: goneError } = await supabase
      .from("bd_releases")
      .delete({ count: "exact" })
      .gte("release_date", today)
      .lt("last_seen_at", now);
    if (goneError) throw new Error(`Nettoyage impossible : ${goneError.message}`);
    const { count: old, error: oldError } = await supabase
      .from("bd_releases")
      .delete({ count: "exact" })
      .lt("release_date", twoMonthsAgo);
    if (oldError) throw new Error(`Nettoyage impossible : ${oldError.message}`);

    return {
      ok: true,
      found: releases.length,
      upserted: rows.length,
      removed: (gone ?? 0) + (old ?? 0),
      firstDate: releases[0].date,
      lastDate: releases.at(-1)!.date,
    };
  } catch (error) {
    console.error("Synchro sorties BD :", error);
    return { ...empty, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
