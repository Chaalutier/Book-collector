"use client";

import Link from "next/link";
import BookCover from "@/app/components/BookCover";
import SearchResult from "@/app/search/SearchResult";
import type { CalendarEntry, CalendarReason } from "@/lib/calendar";
import { STATUS_STYLES, formatContributors, formatDate, formatVolume } from "@/lib/labels";

export const REASON_STYLES: Record<CalendarReason["kind"], string> = {
  wishlist: STATUS_STYLES.wishlist,
  owned: STATUS_STYLES.ordered,
  series: "bg-soft text-accent-strong",
  author: "bg-[#f5ecd7] text-[#76561a]",
};

/** Date lisible : « jeudi 5 novembre », « novembre 2026 (jour à confirmer) »… */
export function entryDateLabel(date: string) {
  if (date.length >= 10) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }
  return date.length === 7 ? "Jour à confirmer" : "Date à confirmer";
}

/** Un livre à paraître : la ligne de la wishlist/bibliothèque, ou le résultat de recherche ajoutable */
export default function EntryCard({ entry, showDate = true }: { entry: CalendarEntry; showDate?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {showDate && <span className="font-medium capitalize">{entryDateLabel(entry.date)}</span>}
        {entry.reasons.map((r) => (
          <span key={`${r.kind}-${r.label}`} className={`rounded-full px-2 py-0.5 ${REASON_STYLES[r.kind]}`}>
            {r.label}
          </span>
        ))}
      </div>
      {entry.userBook ? (
        <OwnedRow entry={entry} />
      ) : (
        <SearchResult candidate={entry.candidate!} ownedUserBookId={null} />
      )}
    </div>
  );
}

function OwnedRow({ entry }: { entry: CalendarEntry }) {
  const { book, id } = entry.userBook!;
  const volume = formatVolume(book.volume_number);
  return (
    <div className="flex gap-4">
      <Link href={`/library/${id}`} className="block w-20 shrink-0 sm:w-24">
        <BookCover src={book.cover_url} title={book.title} isbn={book.isbn13 ?? book.isbn10} />
      </Link>
      <div className="min-w-0 flex-1">
        {book.series && (
          <p className="text-xs font-medium text-accent-strong">
            {book.series.title}
            {volume && ` · ${volume}`}
          </p>
        )}
        <Link href={`/library/${id}`} className="font-semibold hover:underline">
          {book.title}
        </Link>
        <p className="text-sm text-muted">
          {formatContributors(book.contributors)}
          {book.publisher && ` · ${book.publisher}`}
          {entry.date.length < 10 && ` · ${formatDate(entry.date)}`}
        </p>
      </div>
    </div>
  );
}
