"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BookCover from "@/app/components/BookCover";
import { formatContributors, formatDate } from "@/lib/labels";
import type { Suggestion } from "@/lib/catalog";

/** Champ de recherche avec aperçu des 5 premiers résultats pendant la frappe */
export default function SearchBox({ query, wishlistMode }: { query: string; wishlistMode: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.trim();
    // Pas d'aperçu avant que l'utilisateur tape, ni pour la recherche déjà affichée
    if (!typed.current || q.length < 3 || q === query) return setSuggestions([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Suggestion[]) => {
          setSuggestions(list);
          setActive(-1);
          setOpen(true);
        })
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, query]);

  // Un aperçu mène à cette édition précise (par ISBN quand on l'a)
  const choose = (c: Suggestion) => {
    const params = new URLSearchParams({ q: c.isbn13 ?? c.isbn10 ?? c.title });
    if (wishlistMode) params.set("to", "wishlist");
    setOpen(false);
    router.push(`/search?${params}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 = le champ lui-même ; on boucle champ → aperçus → champ
      const n = suggestions.length + 1;
      setActive((i) => ((i + 1 + step + n) % n) - 1);
    } else if (e.key === "Enter" && active >= 0 && active < suggestions.length) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <form action="/search" className="relative mt-4 flex gap-2" onSubmit={() => setOpen(false)}>
      {wishlistMode && <input type="hidden" name="to" value="wishlist" />}
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-suggestions"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        placeholder="Rechercher…"
        className="field text-base"
      />
      <button type="submit" className="btn-primary">
        Rechercher
      </button>

      {showList && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lg"
        >
          {suggestions.map((c, i) => (
            <li
              key={c.isbn13 ?? c.isbn10 ?? c.title}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-soft" : "hover:bg-soft"}`}
            >
              <div className="w-8 shrink-0">
                <BookCover src={c.cover_url} title={c.title} isbn={c.isbn13 ?? c.isbn10} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted">
                  {[formatContributors(c.contributors), formatDate(c.published_date)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
