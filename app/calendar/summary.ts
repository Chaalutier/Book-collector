import type { CalendarEntry } from "@/lib/calendar";

/** « 3 sorties · 1 en wishlist · 2 suites de série » */
export function monthSummary(entries: CalendarEntry[]) {
  const count = (kind: string) => entries.filter((e) => e.reasons.some((r) => r.kind === kind)).length;
  const parts = [`${entries.length} sortie${entries.length > 1 ? "s" : ""}`];
  const wishlist = count("wishlist");
  const owned = count("owned");
  const series = count("series");
  const author = count("author");
  if (owned) parts.push(`${owned} déjà à toi`);
  if (wishlist) parts.push(`${wishlist} en wishlist`);
  if (series) parts.push(`${series} suite${series > 1 ? "s" : ""} de série`);
  if (author) parts.push(`${author} d'auteur suivi`);
  return parts.join(" · ");
}
