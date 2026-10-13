/** Garde uniquement chiffres (et X final pour un ISBN-10) */
export function cleanIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
}

/** La saisie de l'utilisateur ressemble-t-elle à un ISBN ? */
export function looksLikeIsbn(query: string): string | null {
  const cleaned = query.replace(/[\s-]/g, "");
  if (/^(97[89])?\d{9}[\dXx]$/.test(cleaned)) return cleanIsbn(cleaned);
  return null;
}

/** Convertit un ISBN-10 en ISBN-13 (utile pour dédoublonner) */
export function isbn10to13(isbn10: string): string {
  const base = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + String((10 - (sum % 10)) % 10);
}

const VOLUME_PATTERN =
  /^(.*?)[\s,.:;\-–—(]*\b(?:tome|t\.|vol\.?|volume|n°|no\.?|#)\s*(\d+(?:[.,]\d+)?)\)?\s*(?:[:\-–—.]\s*(.*))?$/i;

/**
 * Essaie d'extraire série + tome d'un titre :
 *  "One Piece - Tome 9"            -> { series: "One Piece", volume: 9 }
 *  "Astérix, tome 12 : Astérix aux jeux olympiques"
 *                                   -> { series: "Astérix", volume: 12, rest: "Astérix aux jeux olympiques" }
 */
export function parseSeriesFromTitle(
  title: string
): { series: string; volume: number; rest: string | null } | null {
  const match = title.match(VOLUME_PATTERN);
  if (!match) return null;
  let series = match[1].trim();
  const volume = Number(match[2].replace(",", "."));
  let rest = match[3]?.trim() || null;
  if (!series || Number.isNaN(volume)) return null;

  // "Dungeon Crawler Carl : L'Ogive du jugement dernier - Tome 2"
  //  -> série "Dungeon Crawler Carl", titre du tome "L'Ogive du jugement dernier"
  const split = splitSeriesAndTitle(series);
  if (split) {
    series = split.series;
    rest = rest ?? split.title;
  }
  return { series, volume, rest };
}

/** "Série : Titre" ou "Série - Titre" -> { series, title } */
export function splitSeriesAndTitle(value: string): { series: string; title: string } | null {
  const match = value.match(/^(.+?)\s*(?:\s:\s?|\s[-–—]\s)\s*(.+)$/);
  if (!match) return null;
  const series = match[1].trim();
  const title = match[2].trim();
  return series && title ? { series, title } : null;
}

/** Comparaison de titres insensible à la casse, aux accents et à la ponctuation */
export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Rapproche un nom de série détecté d'une série déjà en base :
 *  "Dungeon Crawler Carl : L'Oeil de la Veuve du Chaos" -> "Dungeon Crawler Carl"
 *  "One piece" -> "One Piece"
 */
export function matchExistingSeries(candidate: string, existing: string[]): string | null {
  const norm = normalizeTitle(candidate);
  if (!norm) return null;
  const exact = existing.find((s) => normalizeTitle(s) === norm);
  if (exact) return exact;
  // "Série : sous-titre" dont la partie "Série" existe déjà
  const split = splitSeriesAndTitle(candidate);
  if (split) {
    const head = normalizeTitle(split.series);
    return existing.find((s) => normalizeTitle(s) === head) ?? null;
  }
  return null;
}

/** Garde l'année ou la date ISO telle quelle ("2013", "2013-05-02") */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.match(/\d{4}(-\d{2}(-\d{2})?)?/);
  return iso ? iso[0] : null;
}

/** Collections d'éditeur (poche, etc.) : ce ne sont pas des séries de livres */
const PUBLISHER_COLLECTION =
  /^(le )?livre de poche|^folio\b|^j ai lu\b|^pocket\b|^points\b|^babel\b|^10 ?18\b|^poche\b|^l imaginaire\b|^bibliotheque (gallimard|de la pleiade)|^pleiade\b|^collection\b|^super 8\b|^le masque\b|^presses pocket\b|^lgf\b|^j ai lu /;

/**
 * Écarte les fausses séries : « Le Livre de poche » n° 37528 est un numéro de catalogue
 * de la collection, pas le tome d'une saga. Un vrai tome dépasse rarement quelques centaines.
 */
export function cleanSeries<T extends { series: string | null; volume: number | null }>(value: T): T {
  const series = value.series?.trim() || null;
  if (series && PUBLISHER_COLLECTION.test(normalizeTitle(series))) {
    return { ...value, series: null, volume: null };
  }
  if (value.volume !== null && (value.volume > 500 || value.volume < 0)) {
    // Numéro aberrant : on garde la série mais pas le tome
    return { ...value, volume: null };
  }
  return value;
}

const MONTH_NAMES = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Date saisie à la main -> "AAAA-MM-JJ", "AAAA-MM" ou "AAAA" (date partielle acceptée).
 * Formats : 5/11/2026, 05-11-2026, 11/2026, 2026, 2026-11-05, 2026-11, "5 novembre 2026", "novembre 2026".
 * Renvoie `undefined` si la saisie n'est pas une date valide (null = champ vide).
 */
export function parseUserDate(input: string | null | undefined): string | null | undefined {
  const raw = (input ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!raw) return null;

  let y: number, m: number | null = null, d: number | null = null;
  let match: RegExpMatchArray | null;

  if ((match = raw.match(/^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?$/))) {
    y = Number(match[1]);
    m = match[2] ? Number(match[2]) : null;
    d = match[3] ? Number(match[3]) : null;
  } else if ((match = raw.match(/^(?:(\d{1,2})[-/.\s])?(\d{1,2})[-/.\s](\d{4})$/))) {
    d = match[1] ? Number(match[1]) : null;
    m = Number(match[2]);
    y = Number(match[3]);
  } else if ((match = raw.match(/^(?:(\d{1,2})(?:er)?\s+)?([a-z]+)\.?\s+(\d{4})$/))) {
    const idx = MONTH_NAMES.findIndex((name) => name.startsWith(match![2]) && match![2].length >= 3);
    if (idx < 0) return undefined;
    d = match[1] ? Number(match[1]) : null;
    m = idx + 1;
    y = Number(match[3]);
  } else {
    return undefined;
  }

  if (y < 1000 || y > 2200) return undefined;
  if (m !== null && (m < 1 || m > 12)) return undefined;
  if (d !== null) {
    if (m === null || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return undefined;
  }
  return m === null ? String(y) : d === null ? `${y}-${pad(m)}` : `${y}-${pad(m)}-${pad(d)}`;
}
