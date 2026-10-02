import type { BookCategory } from "@/types/book";

/**
 * Indices collectés auprès de Google Books et de la BnF pour deviner
 * si un livre est un roman, un essai, un manga ou une BD.
 */
export type CategorySignals = {
  /** Google Books : "Comics & Graphic Novels / Manga / General", "Fiction"… */
  googleCategories?: string[];
  /** BnF 608 : forme / genre ("Mangas", "Bandes dessinées", "Romans"…) */
  genreForms?: string[];
  /** BnF 676 / 686 : indices Dewey ("741.5", "843.92"…) */
  dewey?: string[];
  /** BnF 225 : collections ("Shonen manga", "Folio"…) */
  collections?: string[];
  /** BnF 101 $c : langue d'origine ("jpn", "eng"…) */
  originalLanguage?: string | null;
  publisher?: string | null;
  /** BnF 215 $d : hauteur en cm */
  heightCm?: number | null;
  pageCount?: number | null;
  isIllustrated?: boolean;
  /** Présence d'un dessinateur / scénariste */
  hasArtist?: boolean;
  title?: string | null;
  description?: string | null;
};

export type CategoryGuess = {
  category: BookCategory;
  /** Raisons lisibles, ex. ["éditeur Kana", "langue d'origine : japonais"] */
  reasons: string[];
  /** 0 → 1 */
  confidence: number;
};

// Éditeurs (ou labels) spécialisés — comparés sans accents ni casse
const MANGA_PUBLISHERS = [
  "kana", "ki-oon", "kioon", "pika", "kurokawa", "tonkam", "kaze", "crunchyroll",
  "akata", "doki-doki", "nobi nobi", "mangetsu", "meian", "noeve", "vega",
  "black box", "taifu", "komikku", "ototo", "soleil manga", "panini manga",
  "glenat manga", "delcourt tonkam", "kazoku", "naban", "isan manga", "kotoji",
  "shueisha", "kodansha", "shogakukan", "viz media", "yen press", "seven seas",
];
const COMIC_PUBLISHERS = [
  "dupuis", "dargaud", "le lombard", "lombard", "casterman", "bamboo", "futuropolis",
  "rue de sevres", "humanoides associes", "albert rene", "fluide glacial",
  "vents d'ouest", "grand angle", "marsu", "la gouttiere", "urban comics",
  "panini comics", "delcourt", "soleil", "glenat", "editions du long bec",
  "dupuis jeunesse", "ankama", "steinkis", "la boite a bulles", "l'association",
  "cornelius", "shampooing", "sarbacane", "marvel", "dc comics", "image comics",
];
// Éditeurs mixtes : un indice faible seulement
const WEAK_COMIC_PUBLISHERS = ["delcourt", "soleil", "glenat"];

const ASIAN_LANGUAGES: Record<string, string> = {
  jpn: "japonais", ja: "japonais", kor: "coréen", ko: "coréen", chi: "chinois", zh: "chinois",
};

const NONFICTION_GOOGLE =
  /histor|philosoph|political|social science|science|biography|autobiograph|business|economics|psycholog|religion|self-help|education|health|true crime|law|medical|nature|travel|language arts|reference|cooking|art\b|music|sports|technology|mathematics|computers|family/i;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function guessCategoryFromSignals(signals: CategorySignals): CategoryGuess {
  const score: Record<BookCategory, number> = { novel: 0.5, essay: 0, manga: 0, comic: 0 };
  const reasons: Record<BookCategory, string[]> = { novel: [], essay: [], manga: [], comic: [] };
  const add = (cat: BookCategory, points: number, reason: string) => {
    score[cat] += points;
    if (!reasons[cat].includes(reason)) reasons[cat].push(reason);
  };

  // 1. Forme / genre BnF : l'indice le plus fiable
  for (const raw of signals.genreForms ?? []) {
    const g = normalize(raw);
    if (/manga|manhwa|manhua|webtoon/.test(g)) add("manga", 6, `genre BnF « ${raw} »`);
    else if (/bande(s)? dessinee|comics|roman(s)? graphique/.test(g)) add("comic", 5, `genre BnF « ${raw} »`);
    else if (/essai|biographie|document|temoignage|recit de vie|manuel|guide/.test(g)) add("essay", 4, `genre BnF « ${raw} »`);
    else if (/roman|fiction|nouvelle|conte|policier|thriller|fantasy|science-fiction|fantastique/.test(g))
      add("novel", 4, `genre BnF « ${raw} »`);
  }

  // 2. Classification Dewey
  for (const raw of signals.dewey ?? []) {
    const d = raw.trim();
    if (/^741\.5/.test(d)) add("comic", 3, `Dewey ${d} (bande dessinée)`);
    else if (/^8\d3/.test(d)) add("novel", 3, `Dewey ${d} (roman)`);
    else if (/^8\d4/.test(d)) add("essay", 2, `Dewey ${d} (essai littéraire)`);
    else if (/^8\d\d/.test(d)) add("novel", 1.5, `Dewey ${d} (littérature)`);
    else if (/^\d{3}/.test(d)) add("essay", 2.5, `Dewey ${d}`);
  }

  // 3. Catégories Google Books
  for (const raw of signals.googleCategories ?? []) {
    const c = normalize(raw);
    if (/manga/.test(c)) add("manga", 5, `catégorie Google « ${raw} »`);
    else if (/comics|graphic novel|bandes? dessinee/.test(c)) add("comic", 3.5, `catégorie Google « ${raw} »`);
    else if (/fiction|roman|poetry|drama|literary collections/.test(c) && !/nonfiction|non-fiction/.test(c))
      add("novel", 3, `catégorie Google « ${raw} »`);
    else if (NONFICTION_GOOGLE.test(c)) add("essay", 3, `catégorie Google « ${raw} »`);
  }

  // 4. Collections (BnF 225)
  for (const raw of signals.collections ?? []) {
    const c = normalize(raw);
    if (/manga|shonen|seinen|shojo|shoujo|josei|kodomo|manhwa|webtoon/.test(c)) add("manga", 4, `collection « ${raw} »`);
    else if (/\bbd\b|bande dessinee|comics/.test(c)) add("comic", 3, `collection « ${raw} »`);
    else if (/essai|documents?|idees|savoirs|biographie|que sais-je/.test(c)) add("essay", 2, `collection « ${raw} »`);
    else if (/roman|folio|livre de poche|pocket|j'ai lu|points|10\/18|policier|thriller|imaginaire|fantasy|sf/.test(c))
      add("novel", 1.5, `collection « ${raw} »`);
  }

  // 5. Éditeur
  if (signals.publisher) {
    const p = normalize(signals.publisher);
    const manga = MANGA_PUBLISHERS.find((name) => p.includes(name));
    const comic = COMIC_PUBLISHERS.find((name) => p.includes(name));
    if (manga) add("manga", 4, `éditeur ${signals.publisher}`);
    else if (comic) add("comic", WEAK_COMIC_PUBLISHERS.includes(comic) ? 1 : 3, `éditeur ${signals.publisher}`);
  }

  // 6. Langue d'origine asiatique : manga si le livre est illustré
  const origin = (signals.originalLanguage ?? "").toLowerCase();
  const asian = ASIAN_LANGUAGES[origin];
  const visual = signals.isIllustrated || signals.hasArtist || score.comic > 0 || score.manga > 0;
  if (asian && visual) add("manga", 4, `traduit du ${asian}`);
  else if (asian) add("novel", 0.5, `traduit du ${asian}`); // light novel probable

  // 7. Dessinateur / scénariste crédité
  if (signals.hasArtist) {
    add(asian ? "manga" : "comic", 2, "dessinateur crédité");
  }

  // 8. Format physique (BnF) : manga ≈ 18 cm, album BD ≈ 30 cm
  if (signals.heightCm && (signals.isIllustrated || signals.hasArtist)) {
    if (signals.heightCm <= 19) add("manga", 1.5, `format poche illustré (${signals.heightCm} cm)`);
    else if (signals.heightCm >= 27) add("comic", 2, `grand format illustré (${signals.heightCm} cm)`);
  }
  if (signals.pageCount && (signals.isIllustrated || signals.hasArtist)) {
    if (signals.pageCount <= 72) add("comic", 1, `${signals.pageCount} pages illustrées`);
    else if (signals.pageCount >= 150 && signals.pageCount <= 260) add("manga", 0.5, `${signals.pageCount} pages illustrées`);
  }

  // 9. Mots-clés du titre / résumé
  const text = normalize(`${signals.title ?? ""} ${signals.description ?? ""}`);
  if (/\b(manga|manhwa|webtoon|shonen|seinen|shojo)\b/.test(text)) add("manga", 2, "mot-clé « manga » dans la description");
  if (/\b(bande dessinee|album bd|roman graphique)\b/.test(text)) add("comic", 1.5, "mot-clé « BD » dans la description");
  if (/\b(essai|enquete|analyse|histoire de|biographie)\b/.test(text)) add("essay", 1, "vocabulaire d'essai dans la description");
  if (/\b(roman|thriller|saga|heroine|heros)\b/.test(text)) add("novel", 1, "vocabulaire de roman dans la description");

  // Le gagnant ; à égalité manga/BD, la langue d'origine tranche
  const ranked = (Object.keys(score) as BookCategory[]).sort((a, b) => score[b] - score[a]);
  let category = ranked[0];
  // Une "BD" traduite du japonais / coréen / chinois est un manga
  if (category === "comic" && asian) {
    category = "manga";
    reasons.manga = [...new Set([...reasons.manga, ...reasons.comic])];
  }

  const top = score[ranked[0]];
  const second = score[ranked[1]];
  // Peu d'indices = faible confiance, même sans concurrent
  const strength = Math.min(1, top / 4);
  const margin = top > 0 ? (top - second) / top : 0;
  const confidence = Math.min(1, strength * (0.4 + 0.6 * margin));

  return {
    category,
    reasons: reasons[category].slice(0, 3),
    confidence: Math.round(Math.max(0, confidence) * 100) / 100,
  };
}

/** Fusionne les indices de deux sources (Google + BnF) */
export function mergeSignals(a: CategorySignals = {}, b: CategorySignals = {}): CategorySignals {
  const list = (x?: string[], y?: string[]) => [...new Set([...(x ?? []), ...(y ?? [])])];
  return {
    googleCategories: list(a.googleCategories, b.googleCategories),
    genreForms: list(a.genreForms, b.genreForms),
    dewey: list(a.dewey, b.dewey),
    collections: list(a.collections, b.collections),
    originalLanguage: b.originalLanguage ?? a.originalLanguage ?? null,
    publisher: b.publisher ?? a.publisher ?? null,
    heightCm: b.heightCm ?? a.heightCm ?? null,
    pageCount: b.pageCount ?? a.pageCount ?? null,
    isIllustrated: Boolean(a.isIllustrated || b.isIllustrated),
    hasArtist: Boolean(a.hasArtist || b.hasArtist),
    title: a.title ?? b.title ?? null,
    description: a.description ?? b.description ?? null,
  };
}

/** Nettoie des indices reçus du navigateur (taille et types bornés) */
export function sanitizeSignals(input: unknown): CategorySignals | undefined {
  if (!input || typeof input !== "object") return undefined;
  const s = input as Record<string, unknown>;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 10).map((x) => x.slice(0, 120)) : [];
  const text = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : null);
  const number = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    googleCategories: strings(s.googleCategories),
    genreForms: strings(s.genreForms),
    dewey: strings(s.dewey),
    collections: strings(s.collections),
    originalLanguage: text(s.originalLanguage, 10),
    publisher: text(s.publisher),
    heightCm: number(s.heightCm),
    pageCount: number(s.pageCount),
    isIllustrated: s.isIllustrated === true,
    hasArtist: s.hasArtist === true,
    title: text(s.title, 300),
    description: text(s.description, 1500),
  };
}
