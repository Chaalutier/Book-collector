import type { BookCategory, ContributorRole, ReadingStatus } from "@/types/book";

export const CATEGORY_LABELS: Record<BookCategory, string> = {
  novel: "Roman",
  essay: "Essai",
  manga: "Manga",
  comic: "BD",
};

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  wishlist: "Wishlist",
  to_read: "À lire",
  reading: "En cours",
  read: "Lu",
  abandoned: "Abandonné",
};

/** Libellé long, utilisé dans les menus déroulants */
export const STATUS_DESCRIPTIONS: Record<ReadingStatus, string> = {
  wishlist: "Wishlist (pas encore acheté)",
  to_read: "Acheté, à lire",
  reading: "En cours de lecture",
  read: "Lu",
  abandoned: "Abandonné",
};

export const STATUS_STYLES: Record<ReadingStatus, string> = {
  wishlist: "bg-[#f6e4e4] text-[#8a4848]",
  to_read: "bg-soft text-accent-strong",
  reading: "bg-[#f5ecd7] text-[#76561a]",
  read: "bg-line text-[#2f4f42]",
  abandoned: "bg-stone-100 text-stone-600",
};

export const ROLE_LABELS: Record<ContributorRole, string> = {
  author: "Auteur",
  scenarist: "Scénario",
  artist: "Dessin",
  colorist: "Couleurs",
  translator: "Traduction",
  other: "Contributeur",
};

/** "9" -> "T.9", 12.5 -> "T.12,5" */
export function formatVolume(volume: number | null | undefined): string | null {
  if (volume === null || volume === undefined) return null;
  return `T.${String(Number(volume)).replace(".", ",")}`;
}

/** Auteurs principaux (hors traducteurs), séparés par des virgules */
export function formatContributors(
  contributors: { name: string; role: ContributorRole }[],
  { withRoles = false }: { withRoles?: boolean } = {}
): string {
  const main = contributors.filter((c) => c.role !== "translator");
  const list = main.length > 0 ? main : contributors;
  if (list.length === 0) return "Auteur inconnu";
  return list
    .map((c) =>
      withRoles && c.role !== "author" ? `${c.name} (${ROLE_LABELS[c.role]})` : c.name
    )
    .join(", ");
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** "2013-05-02" -> "2 mai 2013", "2013-05" -> "mai 2013", "2013" -> "2013" (1er pour le premier du mois) */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return value;
  const [, year, month, day] = m;
  const monthName = month ? MONTHS_FR[Number(month) - 1] : null;
  if (!monthName) return year;
  if (!day) return `${monthName} ${year}`;
  return `${Number(day) === 1 ? "1er" : Number(day)} ${monthName} ${year}`;
}
