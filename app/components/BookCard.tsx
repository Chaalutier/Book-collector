import Link from "next/link";
import { CATEGORY_LABELS, formatContributors, formatVolume } from "@/lib/labels";
import type { UserBook } from "@/types/book";
import BookCover from "./BookCover";
import StatusSelect from "./StatusSelect";

export default function BookCard({ userBook }: { userBook: UserBook }) {
  const { book } = userBook;
  const volume = formatVolume(book.volume_number);

  return (
    <article className="group flex flex-col gap-2">
      <Link href={`/library/${userBook.id}`} className="block transition group-hover:-translate-y-0.5">
        <BookCover src={book.cover_url} title={book.title} />
      </Link>

      <div className="min-w-0 flex-1">
        {book.series && (
          <p className="truncate text-xs font-medium text-accent-strong">
            {book.series.title}
            {volume && ` · ${volume}`}
          </p>
        )}
        <Link href={`/library/${userBook.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
          {book.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {formatContributors(book.contributors)} · {CATEGORY_LABELS[book.category]}
        </p>
      </div>

      <StatusSelect userBookId={userBook.id} status={userBook.status} />
    </article>
  );
}
