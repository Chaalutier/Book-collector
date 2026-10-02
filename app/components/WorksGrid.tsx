import Link from "next/link";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLES, formatContributors, formatVolume } from "@/lib/labels";
import type { CatalogWork } from "@/lib/library";
import BookCover from "./BookCover";

/** Livres du catalogue, avec repère « dans ma bibliothèque » + statut */
export default function WorksGrid({ works }: { works: CatalogWork[] }) {
  return (
    <div className="book-grid">
      {works.map(({ book, mine }) => {
        const volume = formatVolume(book.volume_number);
        const cover = <BookCover src={book.cover_url} title={book.title} />;
        return (
          <article key={book.id} className="group flex flex-col gap-2">
            {mine ? (
              <Link href={`/library/${mine.id}`} className="block transition group-hover:-translate-y-0.5">
                {cover}
              </Link>
            ) : (
              <div className="opacity-80">{cover}</div>
            )}
            <div className="min-w-0 flex-1">
              {book.series && (
                <p className="truncate text-xs font-medium text-accent-strong">
                  {book.series.title}
                  {volume && ` · ${volume}`}
                </p>
              )}
              {mine ? (
                <Link href={`/library/${mine.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                  {book.title}
                </Link>
              ) : (
                <p className="line-clamp-2 text-sm font-semibold">{book.title}</p>
              )}
              <p className="truncate text-xs text-muted">
                {formatContributors(book.contributors)} · {CATEGORY_LABELS[book.category]}
              </p>
            </div>
            {mine ? (
              <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[mine.status]}`}>
                {STATUS_LABELS[mine.status]}
              </span>
            ) : (
              <span className="w-fit rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted">
                Pas dans ma bibliothèque
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
