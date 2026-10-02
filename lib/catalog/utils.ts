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
