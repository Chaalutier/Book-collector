import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import BookCover from "@/app/components/BookCover";
import BookLoader from "@/app/components/BookLoader";
import { formatContributors, formatDate, formatVolume } from "@/lib/labels";
import { getCurrentUser, getUserLibrary } from "@/lib/library";
import { createClient } from "@/lib/server";
import { autoMatchBook, type ScoredCandidate } from "@/lib/sync";
import { defaultSyncFields, isProvisional } from "@/lib/sync-shared";
import type { UserBook } from "@/types/book";
import QuickApply from "./QuickApply";

const MAX_ROWS = 20;

async function Match({ userBook }: { userBook: UserBook }) {
  let match: ScoredCandidate | null = null;
  try {
    match = await autoMatchBook(userBook.book);
  } catch (error) {
    console.error("autoMatchBook :", error);
  }

  if (!match) {
    return (
      <p className="text-sm text-muted">
        Pas encore référencé.{" "}
        <Link href={`/library/${userBook.id}#completer`} className="underline">
          Chercher à la main
        </Link>
      </p>
    );
  }

  const fields = defaultSyncFields({ ...userBook.book, provisional: true }, match);
  return (
    <div className="flex gap-3 rounded-lg bg-soft p-2">
      <div className="w-12 shrink-0">
        <BookCover src={match.cover_url} title={match.title} isbn={match.isbn13 ?? match.isbn10} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-accent-strong">Trouvé</p>
        <p className="truncate text-sm font-semibold">{match.title}</p>
        <p className="truncate text-xs text-muted">
          {formatContributors(match.contributors)}
          {match.published_date && ` · ${formatDate(match.published_date)}`}
          {match.isbn13 && ` · ISBN ${match.isbn13}`}
        </p>
        <QuickApply userBookId={userBook.id} candidate={match} fields={fields} />
      </div>
    </div>
  );
}

export default async function SyncPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const library = await getUserLibrary(supabase, user.id);
  const provisional = library
    .filter((ub) => isProvisional(ub.book))
    .sort((a, b) => (a.book.published_date ?? "9999").localeCompare(b.book.published_date ?? "9999"));
  const shown = provisional.slice(0, MAX_ROWS);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        ← Ma bibliothèque
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Fiches à compléter</h1>
      <p className="mt-1 text-sm text-muted">
        Livres ajoutés à la main, sans référence de catalogue. Pour chacun, je cherche s&apos;il est désormais
        référencé ; tu valides en un clic.
      </p>

      {provisional.length === 0 ? (
        <p className="mt-10 text-center text-muted">Toutes tes fiches sont complètes. 🎉</p>
      ) : (
        <ul className="mt-6 divide-y divide-line">
          {shown.map((ub) => (
            <li key={ub.id} className="py-4">
              <p className="text-sm">
                <Link href={`/library/${ub.id}`} className="font-semibold hover:underline">
                  {ub.book.series ? `${ub.book.series.title} ${formatVolume(ub.book.volume_number) ?? ""} · ` : ""}
                  {ub.book.title}
                </Link>
                <span className="text-muted">
                  {" "}
                  — {formatContributors(ub.book.contributors)}
                  {ub.book.published_date && ` · prévu ${formatDate(ub.book.published_date)}`}
                </span>
              </p>
              <div className="mt-2">
                <Suspense fallback={<BookLoader scale={0.5} label={null} className="!py-2" />}>
                  <Match userBook={ub} />
                </Suspense>
              </div>
            </li>
          ))}
        </ul>
      )}
      {provisional.length > MAX_ROWS && (
        <p className="mt-4 text-center text-xs text-muted">
          {provisional.length - MAX_ROWS} autre(s) fiche(s) : complète d&apos;abord celles-ci.
        </p>
      )}
    </main>
  );
}
