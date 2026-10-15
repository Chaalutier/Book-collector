import { load } from "cheerio";

/**
 * Lecture de la page « Sorties BD » de bede.fr (utilisée avec l'accord du site).
 *
 * Le parseur ne dépend pas des classes CSS : il parcourt le document dans l'ordre,
 * retient le dernier titre « Sorties … du <jour> <d> <mois> <aaaa> » rencontré et
 * rattache à cette date chaque couverture d'album (/media/albums/<id>.jpg) qui suit.
 * Tout autre titre (« Ces figurines… », « TOP 10… ») clôt la liste du jour.
 */

export const BEDE_BASE = "https://www.bede.fr";

export type BedeRelease = {
  /** N° d'album bede.fr */
  id: string;
  /** "2026-10-16" */
  date: string;
  title: string;
  series_title: string | null;
  volume_number: number | null;
  publisher: string | null;
  url: string;
  cover_url: string;
  page: string;
};

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const BADGES = /^(extrait disponible|lire|nouveau)$/i;

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** "Sorties BD du mercredi 14 octobre 2026" → "2026-10-14" */
export function parseHeadingDate(text: string): string | null {
  const t = norm(text);
  if (!t.startsWith("sorties")) return null;
  const m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
  if (!m || !MONTHS[m[2]]) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(Number(m[1]))}`;
}

function albumIdFrom(src: string | undefined): string | null {
  return String(src ?? "").match(/\/media\/albums\/(\d+)\./)?.[1] ?? null;
}

/**
 * "Le Scorpion - Tome 15 - Le Secret…" → { series: "Le Scorpion", volume: 15 }.
 * Les intégrales, coffrets et lots (« Intégrale T05 à T08 ») ne sont pas des tomes.
 */
export function splitSeries(title: string): { series: string | null; volume: number | null } {
  if (/int[ée]grale|coffret|[ée]crin|tomes?\s*\d+\s*(?:à|a|-|et)\s*\d+|t\d+\s*(?:à|a)\s*t?\d+/i.test(title)) {
    return { series: null, volume: null };
  }
  const m = title.match(/^(.*?)(?:\s*[-,:]\s*|\s+)(?:tome|t)\s?0*(\d+)\b/i);
  if (m && m[1].trim().length > 1) return { series: clean(m[1]), volume: Number(m[2]) };
  return { series: null, volume: null };
}

export function parseBedePage(html: string, page = "bd"): BedeRelease[] {
  const $ = load(html);
  const out: BedeRelease[] = [];
  const seen = new Set<string>();
  let currentDate: string | null = null;

  // Préfère l'attribut qui pointe vers une couverture (src peut être une image vide en chargement différé)
  const srcOf = (el: Parameters<typeof $>[0]) => {
    const $el = $(el);
    const candidates = [
      $el.attr("data-src"),
      $el.attr("data-original"),
      $el.attr("data-lazy-src"),
      ($el.attr("srcset") ?? "").split(/\s+/)[0],
      $el.attr("src"),
    ];
    return candidates.find((c) => albumIdFrom(c)) ?? $el.attr("src");
  };

  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-4]$/.test(tag)) {
      const text = clean($(el).text());
      const date = parseHeadingDate(text);
      currentDate = date ?? (norm(text).startsWith("sorties") ? currentDate : null);
      return;
    }
    if (tag !== "img" || !currentDate) return;

    const src = srcOf(el);
    const id = albumIdFrom(src);
    if (!id || !src || seen.has(id)) return;
    seen.add(id);

    // La « carte » : plus grand ancêtre qui ne contient que cette couverture
    let card = $(el);
    let parent = card.parent();
    while (parent.length && parent[0].type === "tag" && parent[0].tagName !== "body") {
      const covers = parent.find("img").filter((_, img) => !!albumIdFrom(srcOf(img)));
      if (covers.length > 1) break;
      card = parent;
      parent = parent.parent();
    }

    const texts: string[] = [];
    card.find("*").addBack().contents().each((_, node) => {
      if (node.type !== "text") return;
      const t = clean(node.data);
      if (t && !BADGES.test(t) && !texts.includes(t)) texts.push(t);
    });

    // alt = « Titre - Éditeur »
    const alt = clean($(el).attr("alt"));
    let title = alt;
    let publisher: string | null = null;
    const cut = alt.lastIndexOf(" - ");
    if (cut > 0) {
      title = alt.slice(0, cut);
      publisher = alt.slice(cut + 3);
    }
    // Si la carte affiche l'éditeur puis le titre en texte, ils font foi
    if (texts.length >= 2) {
      const [pub, tit] = texts.slice(-2);
      if (norm(alt) === norm(`${tit} - ${pub}`)) {
        title = tit;
        publisher = pub;
      }
    }
    if (!title) return;

    const href =
      card
        .find("a[href]")
        .map((_, a) => $(a).attr("href"))
        .get()
        .find((h) => h && !/preview-/.test(h)) ?? $(el).closest("a[href]").attr("href");

    const { series, volume } = splitSeries(title);
    out.push({
      id,
      date: currentDate,
      title: title.slice(0, 300),
      series_title: series,
      volume_number: volume,
      publisher: publisher?.slice(0, 200) || null,
      url: href ? new URL(href, BEDE_BASE).href : `${BEDE_BASE}/${page}`,
      cover_url: new URL(src, BEDE_BASE).href,
      page,
    });
  });

  return out;
}
