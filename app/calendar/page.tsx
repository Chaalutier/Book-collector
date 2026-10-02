import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import BookCover from "@/app/components/BookCover";
import SearchResult from "@/app/search/SearchResult";
import { getCalendar, type CalendarEntry, type CalendarReason } from "@/lib/calendar";
import { STATUS_STYLES, formatContributors, formatVolume } from "@/lib/labels";
import { getCurrentUser, getOwnedIndex, getUserLibrary } from "@/lib/library";
import { createClient } from "@/lib/server";

const REASON_STYLES: Record<CalendarReason["kind"], string> = {
  wishlist: STATUS_STYLES.wishlist,
  series: "bg-soft text-accent-strong",
  author: "bg-[#f5ecd7] text-[#76561a]",
};

function monthKey(date: string) {
  return date.slice(0, 7).length === 7 ? date.slice(0, 7) : `${date}-00`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  if (m === "00") return `${y} — date à préciser`;
  const label = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(date: string) {
  if (date.length < 10) return date.length === 7 ? "Jour à confirmer" : "Date à confirmer";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">Calendrier des sorties</h1>
      <p className="mt-1 text-sm text-muted">
        Prochains tomes de tes séries, livres de ta wishlist et nouveautés des auteurs que tu lis.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Recherche des prochaines sorties…</p>}>
        <CalendarContent userId={user.id} />
      </Suspense>
    </main>
  );
}

async function CalendarContent({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [userBooks, owned] = await Promise.all([getUserLibrary(supabase, userId), getOwnedIndex(supabase, userId)]);
  const { entries, tracked, failures } = await getCalendar(userBooks, owned);

  const months = new Map<string, CalendarEntry[]>();
  for (const e of entries) months.set(monthKey(e.date), [...(months.get(monthKey(e.date)) ?? []), e]);

  return (
    <>
      <p className="mt-4 text-xs text-muted">
        Suivi : {tracked.series} série{tracked.series > 1 ? "s" : ""} en cours, {tracked.authors} auteur
        {tracked.authors > 1 ? "s" : ""}, {tracked.wishlist} livre{tracked.wishlist > 1 ? "s" : ""} de la wishlist à
        paraître.
      </p>

      {failures > 0 && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          Google Books n&apos;a pas répondu pour {failures} recherche{failures > 1 ? "s" : ""} : le calendrier peut être
          incomplet (clé API, quota ?).
        </p>
      )}

      {entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          <p className="text-base font-medium text-foreground">Aucune sortie annoncée pour le moment.</p>
          <p className="mt-2">
            Les dates viennent de Google Books, qui ne connaît un livre à l&apos;avance que si l&apos;éditeur l&apos;a
            déjà référencé. Reviens régulièrement, ou ajoute à ta{" "}
            <Link href="/library?status=wishlist" className="underline">
              wishlist
            </Link>{" "}
            des livres déjà annoncés.
          </p>
        </div>
      ) : (
        [...months.entries()].map(([key, list]) => (
          <section key={key} className="mt-8">
            <h2 className="border-b border-line pb-2 text-lg font-semibold">{monthLabel(key)}</h2>
            <ul className="divide-y divide-line">
              {list.map((entry) => (
                <li key={entry.key} className="py-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium capitalize">{dayLabel(entry.date)}</span>
                    {entry.reasons.map((r) => (
                      <span key={`${r.kind}-${r.label}`} className={`rounded-full px-2 py-0.5 ${REASON_STYLES[r.kind]}`}>
                        {r.label}
                      </span>
                    ))}
                  </div>
                  {entry.userBook ? <WishlistRow entry={entry} /> : <SearchResult candidate={entry.candidate!} ownedUserBookId={null} />}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function WishlistRow({ entry }: { entry: CalendarEntry }) {
  const { book, id } = entry.userBook!;
  const volume = formatVolume(book.volume_number);
  return (
    <div className="flex gap-4">
      <Link href={`/library/${id}`} className="block w-20 shrink-0 sm:w-24">
        <BookCover src={book.cover_url} title={book.title} />
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
        </p>
      </div>
    </div>
  );
}
