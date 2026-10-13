// Utilitaires de dates sans dépendance serveur (utilisables dans les composants client)

/** La date est-elle à venir ? (et pas absurdement lointaine) */
export function isUpcoming(date: string | null | undefined, now = new Date()): boolean {
  if (!date) return false;
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  if (Number(date.slice(0, 4)) > year + 2) return false;
  if (date.length >= 10) return date >= today;
  if (date.length === 7) return date >= today.slice(0, 7);
  // Année seule : trop vague pour l'année en cours (souvent une date de parution passée)
  return Number(date) > year;
}
