import type { BookCandidate, Contributor, ContributorRole } from "@/types/book";
import { guessCategoryFromSignals, type CategorySignals } from "./category";
import { cleanIsbn, isbn10to13, normalizeDate, parseSeriesFromTitle } from "./utils";

/**
 * API SRU de la Bibliothèque nationale de France — gratuite, sans clé.
 * Excellente pour les éditions françaises : série, n° de tome,
 * scénariste / dessinateur / traducteur, nombre de pages...
 * Pas de couvertures (on les prend chez Google Books / Open Library).
 * Doc : https://api.bnf.fr/fr/api-sru-catalogue-general
 */
const BNF_SRU_URL = "https://catalogue.bnf.fr/api/SRU";

type Subfields = Record<string, string[]>;
type DataField = { tag: string; ind1: string; ind2: string; subfields: Subfields };
type MarcRecord = { controlfields: Record<string, string>; datafields: DataField[] };

// ---------------------------------------------------------------------
// Mini-parseur UNIMARC XML (évite d'ajouter une dépendance)
// ---------------------------------------------------------------------
function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    // caractères de non-tri (NSB/NSE) utilisés par la BnF autour des articles
    .replace(/[\u0088\u0089\u0098\u009C]/g, "")
    .trim();
}

function parseRecords(xml: string): MarcRecord[] {
  const records: MarcRecord[] = [];
  const recordRegex = /<(?:\w+:)?record\b[^>]*format="[^"]*"[^>]*>([\s\S]*?)<\/(?:\w+:)?record>/g;
  const fallbackRegex = /<mxc:record\b[^>]*>([\s\S]*?)<\/mxc:record>/g;

  const matches = [...xml.matchAll(recordRegex)];
  const bodies = (matches.length > 0 ? matches : [...xml.matchAll(fallbackRegex)]).map(
    (m) => m[1]
  );

  for (const body of bodies) {
    const controlfields: Record<string, string> = {};
    for (const m of body.matchAll(
      /<(?:\w+:)?controlfield\s+tag="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?controlfield>/g
    )) {
      controlfields[m[1]] = decodeXml(m[2]);
    }

    const datafields: DataField[] = [];
    for (const m of body.matchAll(
      /<(?:\w+:)?datafield\s+([^>]*)>([\s\S]*?)<\/(?:\w+:)?datafield>/g
    )) {
      const attrs = m[1];
      const tag = attrs.match(/tag="(\d+)"/)?.[1];
      if (!tag) continue;
      const subfields: Subfields = {};
      for (const s of m[2].matchAll(
        /<(?:\w+:)?subfield\s+code="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?subfield>/g
      )) {
        (subfields[s[1]] ??= []).push(decodeXml(s[2]));
      }
      datafields.push({
        tag,
        ind1: attrs.match(/ind1="([^"]*)"/)?.[1] ?? " ",
        ind2: attrs.match(/ind2="([^"]*)"/)?.[1] ?? " ",
        subfields,
      });
    }

    records.push({ controlfields, datafields });
  }

  return records;
}

const fields = (r: MarcRecord, tag: string) => r.datafields.filter((f) => f.tag === tag);
const first = (r: MarcRecord, tag: string, code: string) =>
  fields(r, tag).find((f) => f.subfields[code]?.length)?.subfields[code]?.[0] ?? null;

// Codes de fonction UNIMARC ($4) -> rôle
const ROLE_BY_CODE: Record<string, ContributorRole> = {
  "070": "author", // auteur du texte
  "690": "scenarist", // scénariste
  "440": "artist", // illustrateur / dessinateur
  "040": "artist", // artiste
  "730": "translator", // traducteur
};

function contributorsFromRecord(r: MarcRecord): Contributor[] {
  const result: Contributor[] = [];
  for (const tag of ["700", "701", "702"]) {
    for (const f of fields(r, tag)) {
      const surname = f.subfields.a?.[0];
      if (!surname) continue;
      const forename = f.subfields.b?.[0];
      const name = forename ? `${forename} ${surname}` : surname;
      const code = f.subfields["4"]?.[0] ?? "070";
      const role = ROLE_BY_CODE[code] ?? "other";
      if (!result.some((c) => c.name === name && c.role === role)) {
        result.push({ name, role });
      }
    }
  }
  // Un livre "texte + dessin" de la même personne -> "author" suffit
  return result;
}

function seriesFromRecord(r: MarcRecord): { title: string; volume: number | null } | null {
  // 461 = lien vers la notice de la série (le plus fiable)
  const link = fields(r, "461").find((f) => f.subfields.t?.length);
  if (link) {
    const vol = Number((link.subfields.v?.[0] ?? "").replace(",", "."));
    // La mention 225 a souvent une meilleure casse ("One Piece" vs "One piece")
    const title =
      fields(r, "225")
        .flatMap((f) => f.subfields.a ?? [])
        .find((a) => a.toLowerCase() === link.subfields.t[0].toLowerCase()) ?? link.subfields.t[0];
    return { title, volume: Number.isFinite(vol) && vol > 0 ? vol : null };
  }
  // 225 = mention de collection / série ; on garde celle qui a un numéro
  const coll = fields(r, "225").find((f) => f.subfields.a?.length && f.subfields.v?.length);
  if (coll) {
    const vol = Number(coll.subfields.v[0].replace(/[^\d.,]/g, "").replace(",", "."));
    return { title: coll.subfields.a[0], volume: Number.isFinite(vol) && vol > 0 ? vol : null };
  }
  // 200 $h = numéro de partie ("One Piece" $h "9" $i "Titre du tome")
  const t200 = fields(r, "200")[0];
  if (t200?.subfields.h?.length && t200.subfields.a?.length) {
    const vol = Number(t200.subfields.h[0].replace(/[^\d.,]/g, "").replace(",", "."));
    return { title: t200.subfields.a[0], volume: Number.isFinite(vol) && vol > 0 ? vol : null };
  }
  // Notices incomplètes : "Dungeon Crawler Carl - Tome 6" rangé en $i ou $e
  for (const text of [...(t200?.subfields.i ?? []), ...(t200?.subfields.e ?? [])]) {
    const parsed = parseSeriesFromTitle(text);
    if (parsed) return { title: parsed.series, volume: parsed.volume };
  }
  return null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function bnfRecordToCandidate(r: MarcRecord): BookCandidate | null {
  const t200 = fields(r, "200")[0];
  if (!t200?.subfields.a?.length) return null;

  const series = seriesFromRecord(r);
  const partTitle = t200.subfields.i?.[0];
  let title = t200.subfields.a[0];
  if (t200.subfields.h?.length) {
    title = partTitle ?? `${title} ${t200.subfields.h[0]}`;
  }

  const isbnRaw = fields(r, "010").map((f) => cleanIsbn(f.subfields.a?.[0]));
  const isbn13 = isbnRaw.find((i) => i?.length === 13) ?? null;
  const isbn10 = isbnRaw.find((i) => i?.length === 10) ?? null;

  const pagesText = first(r, "215", "a") ?? "";
  const pages = Number(pagesText.match(/(\d+)\s*(?:p\.|pages)/)?.[1]);

  const publisher =
    fields(r, "214").find((f) => f.ind2 === "0" && f.subfields.c?.length)?.subfields.c[0] ??
    first(r, "210", "c");
  const date = first(r, "214", "d") ?? first(r, "210", "d");

  const ark = r.controlfields["003"]?.match(/ark:\/12148\/[\w]+/)?.[0] ?? null;

  const illustrationText = [first(r, "215", "c"), ...fields(r, "200").flatMap((f) => f.subfields.g ?? [])]
    .join(" ")
    .toLowerCase();
  const contributors = contributorsFromRecord(r);
  const isIllustrated =
    /ill|dessin/.test(illustrationText) || contributors.some((c) => c.role === "artist");

  const collectionNames = fields(r, "225").flatMap((f) => f.subfields.a ?? []);

  // Indices de catégorie propres à la BnF
  const heightText = first(r, "215", "d") ?? "";
  const height = Number(heightText.match(/(\d+(?:[.,]\d+)?)\s*(?:x|cm)/)?.[1]?.replace(",", "."));
  const signals: CategorySignals = {
    // 608 = forme/genre ; $j des vedettes matière 606/607 = subdivision de forme
    genreForms: [
      ...fields(r, "608").flatMap((f) => f.subfields.a ?? []),
      ...[...fields(r, "606"), ...fields(r, "607")].flatMap((f) => f.subfields.j ?? []),
    ],
    dewey: [...fields(r, "676"), ...fields(r, "686")].flatMap((f) => f.subfields.a ?? []),
    collections: collectionNames,
    originalLanguage: first(r, "101", "c"),
    publisher: publisher ?? null,
    heightCm: Number.isFinite(height) && height > 0 ? height : null,
    pageCount: Number.isFinite(pages) && pages > 0 ? pages : null,
    isIllustrated,
    hasArtist: contributors.some((c) => c.role === "artist" || c.role === "scenarist"),
    title: [title, t200.subfields.e?.[0]].filter(Boolean).join(" "),
    description: first(r, "330", "a"),
  };
  const guess = guessCategoryFromSignals(signals);

  return {
    source: "bnf",
    google_books_id: null,
    bnf_ark: ark,
    title: capitalize(title),
    subtitle: t200.subfields.e?.[0] ?? null,
    description: first(r, "330", "a"),
    category: guess.category,
    category_reasons: guess.reasons,
    category_signals: signals,
    series_title: series?.title ?? null,
    volume_number: series?.volume ?? null,
    isbn10,
    isbn13: isbn13 ?? (isbn10 ? isbn10to13(isbn10) : null),
    cover_url: null,
    publisher: publisher ?? null,
    published_date: normalizeDate(date),
    page_count: Number.isFinite(pages) && pages > 0 ? pages : null,
    language: first(r, "101", "a"),
    contributors,
  };
}

async function querySru(cql: string, maximumRecords: number): Promise<BookCandidate[]> {
  const params = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: cql,
    recordSchema: "unimarcxchange",
    maximumRecords: String(maximumRecords),
  });

  const response = await fetch(`${BNF_SRU_URL}?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`BnF a répondu ${response.status}`);

  const xml = await response.text();
  return parseRecords(xml)
    .map(bnfRecordToCandidate)
    .filter((c): c is BookCandidate => c !== null);
}

/** Notice BnF d'une édition précise */
export async function findBnfByIsbn(isbn: string): Promise<BookCandidate | null> {
  const results = await querySru(`bib.isbn adj "${isbn}"`, 1);
  return results[0] ?? null;
}

/** Recherche plein texte (titre, auteur...) parmi les livres imprimés */
export async function searchBnf(query: string, maximumRecords = 15): Promise<BookCandidate[]> {
  const safe = query.replace(/"/g, " ").trim();
  if (!safe) return [];
  return querySru(`bib.anywhere all "${safe}" and bib.doctype any "a"`, maximumRecords);
}

/** Livres imprimés d'un auteur (index auteur de la BnF) */
export async function searchBnfByAuthor(name: string, maximumRecords = 50): Promise<BookCandidate[]> {
  const safe = name.replace(/"/g, " ").trim();
  if (!safe) return [];
  return querySru(`bib.author all "${safe}" and bib.doctype any "a"`, maximumRecords);
}

/** Livres imprimés d'un éditeur (index éditeur de la BnF) */
export async function searchBnfByPublisher(name: string, maximumRecords = 50): Promise<BookCandidate[]> {
  const safe = name.replace(/"/g, " ").trim();
  if (!safe) return [];
  return querySru(`bib.publisher all "${safe}" and bib.doctype any "a"`, maximumRecords);
}
