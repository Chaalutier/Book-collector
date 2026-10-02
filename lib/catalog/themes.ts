/** Grands thèmes proposés dans « Découvrir » (sujets Google Books, la classification y est en anglais) */
export type Theme = {
  slug: string;
  label: string;
  description: string;
  /** Requête Google Books (opérateur `subject:`) */
  query: string;
  /** Filtre Google Books : uniquement des ebooks (gratuits) */
  filter?: "ebooks" | "free-ebooks";
};

export const THEMES: Theme[] = [
  { slug: "fiction", label: "Fiction", description: "Romans et récits d'imagination", query: 'subject:"fiction"' },
  { slug: "fantasy", label: "Fantasy", description: "Magie, quêtes et mondes imaginaires", query: 'subject:"fantasy"' },
  { slug: "science-fiction", label: "Science-fiction", description: "Futurs, espace et technologies", query: 'subject:"science fiction"' },
  { slug: "policier", label: "Policier & thriller", description: "Enquêtes, suspense et crimes", query: 'subject:"mystery & detective"' },
  { slug: "romance", label: "Romance", description: "Histoires d'amour", query: 'subject:"romance"' },
  { slug: "horreur", label: "Horreur", description: "Frissons et fantastique sombre", query: 'subject:"horror"' },
  { slug: "jeunesse", label: "Jeunesse", description: "Romans pour enfants et adolescents", query: 'subject:"juvenile fiction"' },
  { slug: "bd-manga", label: "BD & manga", description: "Bandes dessinées et romans graphiques", query: 'subject:"comics & graphic novels"' },
  { slug: "biographies", label: "Biographies", description: "Vies et mémoires", query: 'subject:"biography & autobiography"' },
  { slug: "histoire", label: "Histoire", description: "Événements, époques, civilisations", query: 'subject:"history"' },
  { slug: "art", label: "Art", description: "Peinture, cinéma, architecture, photo…", query: 'subject:"art"' },
  { slug: "philosophie", label: "Philosophie", description: "Idées et grands penseurs", query: 'subject:"philosophy"' },
  { slug: "sciences", label: "Sciences", description: "Comprendre le monde", query: 'subject:"science"' },
  { slug: "poesie", label: "Poésie", description: "Poèmes et recueils", query: 'subject:"poetry"' },
  { slug: "developpement-personnel", label: "Développement personnel", description: "Mieux vivre, mieux travailler", query: 'subject:"self-help"' },
  { slug: "ebooks", label: "Ebooks gratuits", description: "Lisibles tout de suite, sans payer", query: 'subject:"fiction"', filter: "free-ebooks" },
];

export function findTheme(slug: string | undefined): Theme | undefined {
  return THEMES.find((t) => t.slug === slug);
}
