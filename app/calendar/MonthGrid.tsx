"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BookCover from "@/app/components/BookCover";
import type { CalendarEntry } from "@/lib/calendar";
import EntryCard from "./EntryCard";
import { monthSummary } from "./summary";

const WEEKDAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

function coverOf(entry: CalendarEntry) {
  const b = entry.userBook?.book ?? entry.candidate!;
  return { src: b.cover_url, title: b.title, isbn: b.isbn13 ?? b.isbn10 };
}

/** Calendrier classique : un seul mois à l'écran, flèches pour changer de mois, clic sur un jour pour le détail ou l'ajout */
export default function MonthGrid({
  entries,
  today: todayProp,
  allowAdd = true,
}: {
  entries: CalendarEntry[];
  today: string;
  /** Liens « + Ajouter une sortie » (masqués sur l'onglet Sorties BD) */
  allowAdd?: boolean;
}) {
  // Date du jour fournie par le serveur ; repli sur l'horloge si le format est inattendu
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayProp ?? "") ? todayProp : new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7))); // 1-12
  const [selected, setSelected] = useState<number | null>(Number(today.slice(8, 10)));

  const monthKey = `${year}-${pad(month)}`;

  const { byDay, monthOnly, yearOnly, inMonth } = useMemo(() => {
    const byDay = new Map<number, CalendarEntry[]>();
    const monthOnly: CalendarEntry[] = [];
    const yearOnly: CalendarEntry[] = [];
    const inMonth: CalendarEntry[] = [];
    for (const e of entries) {
      if (e.date.length >= 10 && e.date.startsWith(monthKey)) {
        const day = Number(e.date.slice(8, 10));
        byDay.set(day, [...(byDay.get(day) ?? []), e]);
        inMonth.push(e);
      } else if (e.date.length === 7 && e.date === monthKey) {
        monthOnly.push(e);
        inMonth.push(e);
      } else if (e.date.length === 4 && e.date === String(year)) {
        yearOnly.push(e);
      }
    }
    return { byDay, monthOnly, yearOnly, inMonth };
  }, [entries, monthKey, year]);

  const go = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
    setSelected(null);
  };
  const goToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelected(Number(today.slice(8, 10)));
  };

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // lundi = 0
  // Cases vides avant le 1er, les jours du mois, puis cases vides jusqu'à compléter la dernière semaine
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayDay = today.startsWith(`${monthKey}-`) ? Number(today.slice(8, 10)) : null;
  const selectedEntries = selected ? (byDay.get(selected) ?? []) : [];
  const addHref = (date: string) =>
    `/search/manual?to=wishlist&back=calendar&date=${encodeURIComponent(date)}`;

  return (
    <div className="mt-6">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Mois précédent"
          className="btn-ghost h-10 w-10 justify-center px-0 text-lg"
        >
          ‹
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            {MONTHS[month - 1]} <span className="text-muted">{year}</span>
          </h2>
          <p className="text-xs text-muted">{inMonth.length ? monthSummary(inMonth) : "Aucune sortie ce mois-ci"}</p>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Mois suivant"
          className="btn-ghost h-10 w-10 justify-center px-0 text-lg"
        >
          ›
        </button>
      </div>
      <div className="mt-2 text-center">
        <button type="button" onClick={goToday} className="text-xs text-accent-strong underline">
          Aujourd&apos;hui
        </button>
      </div>

      {/* Grille */}
      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-soft py-1 font-medium text-muted">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-14 bg-background/60 sm:min-h-24" />;
          const list = byDay.get(day) ?? [];
          const isSelected = selected === day;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(day)}
              aria-pressed={isSelected}
              aria-label={`${day} ${MONTHS[month - 1]}${list.length ? `, ${list.length} sortie(s)` : ""}`}
              className={`flex min-h-14 cursor-pointer flex-col items-center gap-1 p-1 text-left hover:bg-soft sm:min-h-24 sm:items-stretch ${
                isSelected ? "bg-soft ring-2 ring-inset ring-accent" : "bg-card"
              }`}
            >
              <span
                className={`self-start text-xs ${
                  todayDay === day
                    ? "rounded-full bg-accent px-1.5 font-semibold text-white"
                    : list.length
                      ? "font-semibold"
                      : "text-muted"
                }`}
              >
                {day}
              </span>
              {list.length > 0 && (
                <>
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.key} className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ))}
                  </span>
                  <span className="hidden gap-1 sm:flex">
                    {list.slice(0, 3).map((e) => {
                      const c = coverOf(e);
                      return (
                        <span key={e.key} className="w-7">
                          <BookCover src={c.src} title={c.title} isbn={c.isbn} />
                        </span>
                      );
                    })}
                    {list.length > 3 && <span className="self-end text-[10px] text-muted">+{list.length - 3}</span>}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Détail du jour sélectionné + ajout */}
      {selected && (
        <div className="mt-4 rounded-xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold capitalize">
              {new Date(Date.UTC(year, month - 1, selected)).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })}
            </p>
            {allowAdd && (
              <Link
                href={addHref(`${pad(selected)}/${pad(month)}/${year}`)}
                className="btn-primary px-3 py-1 text-sm"
              >
                + Ajouter une sortie
              </Link>
            )}
          </div>
          {selectedEntries.length > 0 ? (
            <ul className="mt-3 divide-y divide-line">
              {selectedEntries.map((e) => (
                <li key={e.key} className="py-3 first:pt-0 last:pb-0">
                  <EntryCard entry={e} showDate={false} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Rien de prévu ce jour-là.</p>
          )}
        </div>
      )}

      {/* Dates incomplètes */}
      {monthOnly.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold">En {MONTHS[month - 1].toLowerCase()} — jour à confirmer</p>
          <ul className="divide-y divide-line">
            {monthOnly.map((e) => (
              <li key={e.key} className="py-3">
                <EntryCard entry={e} showDate={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {yearOnly.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold">En {year} — mois à confirmer</p>
          <ul className="divide-y divide-line">
            {yearOnly.map((e) => (
              <li key={e.key} className="py-3">
                <EntryCard entry={e} showDate={false} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {allowAdd && (
        <p className="mt-6 text-center">
          <Link href={addHref(`${pad(month)}/${year}`)} className="text-sm text-accent-strong underline">
            + Ajouter une sortie sans jour précis ({MONTHS[month - 1].toLowerCase()} {year})
          </Link>
        </p>
      )}
    </div>
  );
}
