#!/usr/bin/env node
/**
 * scrape-bede.mjs — Récupère les prochaines sorties de https://www.bede.fr/bd
 * et produit un calendrier .ics (importable dans Google Agenda, Apple Calendrier,
 * Outlook…) ainsi qu'un fichier JSON réutilisable (ex. page /calendar de Bouck).
 *
 * Export ponctuel en .ics (le site, lui, se met à jour tout seul via /api/cron/sorties-bd).
 * Usage (cheerio est déjà dans les dépendances du projet) :
 *   node scripts/scrape-bede.mjs                       # sorties BD → sorties-bd.ics + sorties-bd.json
 *   node scripts/scrape-bede.mjs --pages bd,manga,comics
 *   node scripts/scrape-bede.mjs --out ./data
 *   node scripts/scrape-bede.mjs --editeur glenat,dupuis   # filtre sur l'éditeur (insensible à la casse)
 *   node scripts/scrape-bede.mjs --jours 30                # seulement les 30 prochains jours
 *   node scripts/scrape-bede.mjs --html page.html          # parse un fichier HTML local (test)
 *
 * Le parseur ne dépend pas des classes CSS du site : il suit l'ordre du document,
 * retient le dernier titre « Sorties … du <jour> <d> <mois> <aaaa> » rencontré et
 * rattache à cette date chaque couverture d'album (/media/albums/<id>.jpg) qui suit.
 */

import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------- Options ----------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const PAGES = opt("pages", "bd").split(",").map((s) => s.trim()).filter(Boolean);
const OUT_DIR = opt("out", ".");
const HTML_FILE = opt("html", null);
const EDITEURS = opt("editeur", "")
  .split(",").map((s) => norm(s)).filter(Boolean);
const JOURS = Number(opt("jours", "0")) || 0;

const BASE = "https://www.bede.fr";
const UA = "BouckCalendar/1.0 (usage personnel, avec l'accord de bede.fr)";

const MOIS = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** "Sorties BD du mercredi 14 octobre 2026" → "2026-10-14" (ou null) */
function parseHeadingDate(text) {
  const t = norm(text);
  if (!t.startsWith("sorties")) return null;
  const m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
  if (!m || !MOIS[m[2]]) return null;
  const [d, mo, y] = [Number(m[1]), MOIS[m[2]], Number(m[3])];
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function albumIdFrom(src) {
  const m = String(src ?? "").match(/\/media\/albums\/(\d+)\./);
  return m ? m[1] : null;
}

function imgSrc($img) {
  return (
    $img.attr("src") || $img.attr("data-src") || $img.attr("data-original") ||
    ($img.attr("srcset") || "").split(/\s+/)[0] || ""
  );
}

/** Plus grand ancêtre de l'image qui ne contient qu'une seule couverture d'album = la « carte ». */
function cardOf($, img) {
  let card = $(img);
  let cur = $(img).parent();
  while (cur.length && cur[0].tagName !== "body") {
    const covers = cur.find("img").filter((_, el) => albumIdFrom(imgSrc($(el))));
    if (covers.length > 1) break;
    card = cur;
    cur = cur.parent();
  }
  return card;
}

function parsePage(html, page) {
  const $ = load(html);
  const albums = [];
  let currentDate = null;

  $("*").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (/^h[1-4]$/.test(tag)) {
      const text = clean($(el).text());
      const d = parseHeadingDate(text);
      // Un titre qui n'est pas une date (ex. « Ces figurines… ») clôt la liste du jour.
      currentDate = d ?? (norm(text).startsWith("sorties") ? currentDate : null);
      return;
    }
    if (tag !== "img" || !currentDate) return;

    const $img = $(el);
    const src = imgSrc($img);
    const id = albumIdFrom(src);
    if (!id) return;

    const alt = clean($img.attr("alt")).replace(/&amp;/g, "&");
    const $card = cardOf($, el);

    // Textes de la carte, sans les badges (« Extrait disponible », « Lire », « Nouveau »)
    const texts = [];
    $card.find("*").addBack().contents().each((_, n) => {
      if (n.type === "text") {
        const t = clean(n.data);
        if (t && !/^(extrait disponible|lire|nouveau)$/i.test(t) && !texts.includes(t)) texts.push(t);
      }
    });

    // L'attribut alt vaut « Titre - Éditeur » : l'éditeur est après le dernier « - ».
    let title = alt, publisher = "";
    const cut = alt.lastIndexOf(" - ");
    if (cut > 0) {
      title = alt.slice(0, cut);
      publisher = alt.slice(cut + 3);
    }
    // Si la carte affiche l'éditeur et le titre en texte, ils font foi.
    if (texts.length >= 2) {
      const [pub, tit] = texts.slice(-2);
      if (norm(alt) === norm(`${tit} - ${pub}`)) { title = tit; publisher = pub; }
    }

    const href =
      $card.find("a[href]").map((_, a) => $(a).attr("href")).get()
        .find((h) => h && !/preview-/.test(h)) ||
      $img.closest("a[href]").attr("href") || null;

    const { serie, tome } = splitSerie(title);

    albums.push({
      id,
      date: currentDate,
      title,
      serie,
      tome,
      publisher,
      page,
      url: href ? new URL(href, BASE).href : `${BASE}/${page}`,
      cover: new URL(src.replace("/box/208x285/", "/box/416x570/"), BASE).href,
      coverSmall: new URL(src, BASE).href,
    });
  });

  return albums;
}

/** "Le Scorpion - Tome 15 - Le Secret…" → { serie: "Le Scorpion", tome: 15 } (best effort) */
function splitSerie(title) {
  // Intégrales, coffrets et lots (« Intégrale T05 à T08 ») : pas un tome
  if (/int[ée]grale|coffret|[ée]crin|tomes?\s*\d+\s*(?:à|a|-|et)\s*\d+|t\d+\s*(?:à|a)\s*t?\d+/i.test(title)) {
    return { serie: null, tome: null };
  }
  const m = title.match(/^(.*?)(?:\s*[-,:]\s*|\s+)(?:tome|t)\s?0*(\d+)\b/i);
  if (m && m[1].length > 1) return { serie: clean(m[1]), tome: Number(m[2]) };
  return { serie: null, tome: null };
}

// ---------- iCalendar ----------
function icsEscape(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
/** Plie les lignes à 75 octets (RFC 5545), sans couper un caractère UTF-8. */
function fold(line) {
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const ymd = (iso) => iso.replace(/-/g, "");
function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toICS(albums, name) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bouck//Sorties bede.fr//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(name)}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];
  for (const a of albums) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:bede-${a.id}@bouck`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(a.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(a.date))}`,
      `SUMMARY:${icsEscape(a.title)}`,
      `DESCRIPTION:${icsEscape(`Éditeur : ${a.publisher || "?"}\n${a.url}`)}`,
      `URL:${a.url}`,
      `CATEGORIES:${icsEscape(a.page.toUpperCase())}${a.publisher ? "," + icsEscape(a.publisher) : ""}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------- Main ----------
async function fetchPage(page) {
  const res = await fetch(`${BASE}/${page}`, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr" } });
  if (!res.ok) throw new Error(`${BASE}/${page} → HTTP ${res.status}`);
  return res.text();
}

async function main() {
  let all = [];
  if (HTML_FILE) {
    all = parsePage(await readFile(HTML_FILE, "utf8"), PAGES[0]);
  } else {
    for (const [i, page] of PAGES.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500)); // politesse envers le serveur
      const found = parsePage(await fetchPage(page), page);
      console.log(`${page} : ${found.length} albums`);
      all.push(...found);
    }
  }

  // Dédoublonnage (un album peut apparaître dans plusieurs blocs)
  const seen = new Set();
  let albums = all.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));

  const today = new Date().toISOString().slice(0, 10);
  albums = albums.filter((a) => a.date >= today);
  if (JOURS) {
    const lim = new Date(); lim.setDate(lim.getDate() + JOURS);
    albums = albums.filter((a) => a.date <= lim.toISOString().slice(0, 10));
  }
  if (EDITEURS.length) albums = albums.filter((a) => EDITEURS.some((e) => norm(a.publisher).includes(e)));
  albums.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "fr"));

  if (!albums.length) {
    console.error("Aucun album trouvé : la structure de la page a peut-être changé.");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const base = `sorties-${PAGES.join("-")}`;
  const name = `Sorties ${PAGES.map((p) => p.toUpperCase()).join(" / ")} (bede.fr)`;
  await writeFile(join(OUT_DIR, `${base}.json`),
    JSON.stringify({ source: BASE, generatedAt: new Date().toISOString(), count: albums.length, albums }, null, 2));
  await writeFile(join(OUT_DIR, `${base}.ics`), toICS(albums, name));

  const days = new Set(albums.map((a) => a.date)).size;
  console.log(`✔ ${albums.length} albums sur ${days} jours (${albums[0].date} → ${albums.at(-1).date})`);
  console.log(`  ${join(OUT_DIR, base)}.ics / .json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
