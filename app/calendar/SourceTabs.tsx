import Link from "next/link";

export type Source = "mine" | "bd";

const TABS: { value: Source; label: string }[] = [
  { value: "mine", label: "Mes sorties" },
  { value: "bd", label: "Sorties BD" },
];

/** Onglets du calendrier : sorties liées à ma bibliothèque / toutes les sorties BD (bede.fr) */
export default function SourceTabs({ source, view }: { source: Source; view: "list" | "grid" }) {
  return (
    <nav aria-label="Type de sorties" className="mt-5 flex gap-1 border-b border-line">
      {TABS.map(({ value, label }) => {
        const active = value === source;
        return (
          <Link
            key={value}
            href={value === "bd" ? `/calendar?source=bd&view=${view}` : `/calendar?view=${view}`}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
