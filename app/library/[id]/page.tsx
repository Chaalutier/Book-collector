import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { removeFromLibrary } from "@/app/actions/library";
import BookCover from "@/app/components/BookCover";
import { CATEGORY_LABELS, ROLE_LABELS, formatDate, formatVolume } from "@/lib/labels";
import { getCurrentUser, getUserBook } from "@/lib/library";
import { createClient } from "@/lib/server";
import BookInfoForm from "./BookInfoForm";
import UserBookForm from "./UserBookForm";

export default async function UserBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const userBookId = Number(id);
  if (!Number.isInteger(userBookId)) notFound();

  const userBook = await getUserBook(supabase, user.id, userBookId);
  if (!userBook) notFound();

  const { book } = userBook;
  const volume = formatVolume(book.volume_number);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        ← Ma bibliothèque
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="mx-auto w-40 md:w-full">
          <BookCover src={book.cover_url} title={book.title} />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-muted">{CATEGORY_LABELS[book.category]}</p>
          {book.series && (
            <Link
              href={`/library/series/${book.series.id}`}
              className="mt-1 inline-block text-sm font-medium text-accent-strong hover:underline"
            >
              {book.series.title}
              {volume && ` · ${volume}`}
            </Link>
          )}
          <h1 className="mt-1 text-3xl font-bold">{book.title}</h1>
          {book.subtitle && <p className="mt-1 text-lg text-muted">{book.subtitle}</p>}

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {book.contributors.map((c) => (
              <li key={`${c.name}-${c.role}`}>
                {c.id !== undefined ? (
                  <Link href={`/authors/${c.id}`} className="font-medium text-accent-strong hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
                {c.role !== "author" && <span className="text-muted"> ({ROLE_LABELS[c.role]})</span>}
              </li>
            ))}
          </ul>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Éditeur</dt>
              <dd>
                {book.publisher ? (
                  <Link
                    href={`/publishers/${encodeURIComponent(book.publisher)}`}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    {book.publisher}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {[
              ["Parution", formatDate(book.published_date)],
              ["Pages", book.page_count],
              ["ISBN", book.isbn13 ?? book.isbn10],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-muted">{label}</dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {book.description && (
            <p className="mt-6 text-sm leading-relaxed whitespace-pre-line">{book.description}</p>
          )}

          <section className="mt-8 rounded-xl border border-line bg-card p-5">
            <h2 className="font-semibold">Ma lecture</h2>
            <UserBookForm userBook={userBook} />
          </section>

          <details className="mt-4 rounded-xl border border-line bg-card p-5">
            <summary className="cursor-pointer font-semibold">Corriger la fiche (titre, catégorie, série, tome)</summary>
            <BookInfoForm book={book} />
          </details>

          <form action={removeFromLibrary} className="mt-6">
            <input type="hidden" name="id" value={userBook.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Retirer de ma bibliothèque
            </button>
          </form>

          {book.bnf_ark && (
            <p className="mt-6 text-xs text-muted">
              Notice{" "}
              <a
                href={`https://catalogue.bnf.fr/${book.bnf_ark}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                BnF
              </a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
