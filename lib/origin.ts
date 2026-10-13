/** Origine d'un auteur = « type de littérature » affiché dans la wishlist */
export const ORIGINS = [
  "Française",
  "Anglo-saxonne",
  "Japonaise",
  "Coréenne",
  "Chinoise",
  "Allemande",
  "Italienne",
  "Ibérique / latino-américaine",
  "Russe",
  "Scandinave",
  "Autre",
] as const;
export type Origin = (typeof ORIGINS)[number];

export const isOrigin = (v: unknown): v is Origin => typeof v === "string" && (ORIGINS as readonly string[]).includes(v);

/** Pays Wikidata (Q…) → origine */
const COUNTRY_TO_ORIGIN: Record<string, Origin> = {
  Q142: "Française", Q31: "Française", Q39: "Française",
  Q145: "Anglo-saxonne", Q30: "Anglo-saxonne", Q27: "Anglo-saxonne", Q408: "Anglo-saxonne", Q664: "Anglo-saxonne",
  Q17: "Japonaise",
  Q884: "Coréenne", Q423: "Coréenne",
  Q148: "Chinoise", Q865: "Chinoise", Q8646: "Chinoise",
  Q183: "Allemande", Q40: "Allemande", Q713750: "Allemande", Q16957: "Allemande",
  Q38: "Italienne",
  Q29: "Ibérique / latino-américaine", Q45: "Ibérique / latino-américaine", Q155: "Ibérique / latino-américaine",
  Q96: "Ibérique / latino-américaine", Q414: "Ibérique / latino-américaine", Q739: "Ibérique / latino-américaine",
  Q298: "Ibérique / latino-américaine", Q419: "Ibérique / latino-américaine", Q717: "Ibérique / latino-américaine",
  Q241: "Ibérique / latino-américaine",
  Q159: "Russe", Q15180: "Russe",
  Q34: "Scandinave", Q20: "Scandinave", Q35: "Scandinave", Q33: "Scandinave", Q189: "Scandinave",
};

const WRITER =
  /écrivain|romancier|auteur|poète|essayiste|scénariste|dessinateur|mangaka|writer|novelist|author|poet|essayist|screenwriter|cartoonist|comics|illustrator/i;

type WikidataSearch = { search?: { id: string }[] };
type WikidataEntities = {
  entities?: Record<
    string,
    {
      descriptions?: Record<string, { value: string }>;
      claims?: { P27?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[] };
    }
  >;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "Bouck/1.0 (bibliotheque personnelle)" },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Devine l'origine d'un auteur via Wikidata : premier résultat qui ressemble à un écrivain,
 * puis sa nationalité (P27). Renvoie null si on ne trouve rien de sûr.
 */
export async function detectAuthorOrigin(name: string): Promise<Origin | null> {
  const base = "https://www.wikidata.org/w/api.php";
  const search = await getJson<WikidataSearch>(
    `${base}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&uselang=fr&type=item&limit=4&format=json`
  );
  const ids = (search.search ?? []).map((s) => s.id);
  if (ids.length === 0) return null;

  const data = await getJson<WikidataEntities>(
    `${base}?action=wbgetentities&ids=${ids.join("|")}&props=claims|descriptions&languages=fr|en&format=json`
  );
  for (const id of ids) {
    const entity = data.entities?.[id];
    if (!entity) continue;
    const description = `${entity.descriptions?.fr?.value ?? ""} ${entity.descriptions?.en?.value ?? ""}`;
    if (!WRITER.test(description)) continue;
    for (const claim of entity.claims?.P27 ?? []) {
      const country = claim.mainsnak?.datavalue?.value?.id;
      if (country && COUNTRY_TO_ORIGIN[country]) return COUNTRY_TO_ORIGIN[country];
    }
  }
  return null;
}
