import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import BookLoader from "@/app/components/BookLoader";
import { getBdCalendar } from "@/lib/bede/releases";
import { getCalendar, type CalendarEntry } from "@/lib/calendar";
import { getCurrentUser, getOwnedIndex, getUserLibrary } from "@/lib/library";
import { createClient } from "@/lib/server";
import EntryCard from "./EntryCard";
import MonthGrid from "./MonthGrid";
import SourceTabs, { type Source } from "./SourceTabs";
import ViewSwitch from "./ViewSwitch";
import { monthSummary } from "./summary";

type View = "list" | "grid";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

type MonthGroup = { month: number; entries: CalendarEntry[] }; // month 0 = mois à préciser
type YearGroup = { year: number; months: MonthGroup[] };

/** Regroupe par année puis par mois (les dates triées arrivent déjà dans l'ordre) */
function groupByYearMonth(entries: CalendarEntry[]): YearGroup[] {
  const years = new Map<number, Map<number, CalendarEntry[]>>();
  for (const e of entries) {
    const year = Number(e.date.slice(0, 4));
    const month = e.date.length >= 7 ? Number(e.date.slice(5, 7)) : 0;
    const months = years.get(year) ?? new Map<number, CalendarEntry[]>();
    months.set(month, [...(months.get(month) ?? []), e]);
    years.set(year, months);
  }
  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => ({
      year,
      months: [...months.entries()].sort(([a], [b]) => a - b).map(([month, list]) => ({ month, entries: list })),
    }));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; source?: string; suivi?: string }>;
}) {
  const { view: requested, source: requestedSource, suivi } = await searchParams;
  const source: Source = requestedSource === "bd" ? "bd" : "mine";
  const followedOnly = suivi === "1";
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  // Vue demandée dans l'URL, sinon celle enregistrée dans le profil (liste par défaut)
  let view: View = "list";
  if (requested === "grid" || requested === "list") {
    view = requested;
  } else {
    const { data } = await supabase.from("profiles").select("calendar_view").eq("id", user.id).maybeSingle();
    if ((data as { calendar_view?: string } | null)?.calendar_view === "grid") view = "grid";
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendrier des sorties</h1>
          <p className="mt-1 text-sm text-muted">
            {source === "bd"
              ? "Toutes les BD à paraître chez les éditeurs francophones, mises à jour deux fois par mois."
              : "Prochains tomes de tes séries, livres de ta bibliothèque pas encore sortis et nouveautés des auteurs que tu lis."}
          </p>
        </div>
        <ViewSwitch view={view} source={source} />
      </div>
      <SourceTabs source={source} view={view} />
      {source === "mine" && (
        <Link
          href="/search/manual?to=wishlist&back=calendar"
          className="btn-primary mt-5 w-full justify-center sm:w-auto"
        >
          + Ajouter une sortie
        </Link>
      )}
      <Suspense
        key={`${source}-${view}-${followedOnly}`}
        fallback={<BookLoader label="Recherche des prochaines sorties…" />}
      >
        {source === "bd" ? (
          <BdContent userId={user.id} view={view} followedOnly={followedOnly} />
        ) : (
          <CalendarContent userId={user.id} view={view} />
        )}
      </Suspense>
    </main>
  );
}

async function CalendarContent({ userId, view }: { userId: string; view: View }) {
  const supabase = await createClient();
  const [userBooks, owned] = await Promise.all([getUserLibrary(supabase, userId), getOwnedIndex(supabase, userId)]);
  const { entries, tracked, failures } = await getCalendar(userBooks, owned);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <p className="mt-4 text-xs text-muted">
        Suivi : {tracked.series} série{tracked.series > 1 ? "s" : ""} en cours, {tracked.authors} auteur
        {tracked.authors > 1 ? "s" : ""}, {tracked.wishlist} livre{tracked.wishlist > 1 ? "s" : ""} de ta
        bibliothèque à paraître.
      </p>

      {failures > 0 && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          Google Books n&apos;a pas répondu pour {failures} recherche{failures > 1 ? "s" : ""} : le calendrier peut être
          incomplet (clé API, quota ?).
        </p>
      )}

      {view === "grid" ? (
        <MonthGrid entries={entries} today={today} />
      ) : entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          <p className="text-base font-medium text-foreground">Aucune sortie annoncée pour le moment.</p>
          <p className="mt-2">
            Les dates viennent de Google Books, qui ne connaît un livre à l&apos;avance que si l&apos;éditeur l&apos;a
            déjà référencé. Reviens régulièrement, ajoute à ta{" "}
            <Link href="/library?status=wishlist" className="underline">
              wishlist
            </Link>{" "}
            des livres déjà annoncés, ou{" "}
            <Link href="/search/manual?to=wishlist" className="underline">
              ajoute-en un à la main
            </Link>{" "}
            avec sa date de sortie.
          </p>
        </div>
      ) : (
        <EntriesByMonth entries={entries} />
      )}
    </>
  );
}

/** Liste groupée par année puis par mois */
function EntriesByMonth({ entries }: { entries: CalendarEntry[] }) {
  return groupByYearMonth(entries).map(({ year, months }) => (
    <section key={year} className="mt-12 first:mt-8">
      <h2 className="border-b-2 border-foreground pb-1 text-5xl font-bold tracking-tight">{year}</h2>
      {months.map(({ month, entries: list }) => (
        <div key={month} className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-accent-strong">
            {month === 0 ? "Date à préciser" : MONTHS[month - 1]}
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted">{monthSummary(list)}</p>
          <ul className="divide-y divide-line">
            {list.map((entry) => (
              <li key={entry.key} className="py-4">
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  ));
}

/** Onglet « Sorties BD » : toutes les sorties relevées sur bede.fr */
async function BdContent({ userId, view, followedOnly }: { userId: string; view: View; followedOnly: boolean }) {
  const supabase = await createClient();
  const userBooks = await getUserLibrary(supabase, userId);
  const { entries: all, followed, updatedAt, error } = await getBdCalendar(supabase, userBooks);
  const entries = followedOnly ? all.filter((e) => e.reasons.length > 0) : all;
  const today = new Date().toISOString().slice(0, 10);
  const filterHref = (only: boolean) => `/calendar?source=bd&view=${view}${only ? "&suivi=1" : ""}`;

  if (error) {
    return (
      <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
        Les sorties BD ne sont pas encore disponibles : exécute la migration{" "}
        <code>20261021000000_sorties_bd.sql</code> dans Supabase, puis lance une première mise à jour.
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {[
          { only: false, label: `Toutes (${all.length})` },
          { only: true, label: `Mes séries (${followed})` },
        ].map(({ only, label }) => (
          <Link
            key={label}
            href={filterHref(only)}
            aria-current={followedOnly === only ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${
              followedOnly === only ? "border-accent bg-accent text-white" : "border-line bg-card hover:bg-soft"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Source :{" "}
        <a href="https://www.bede.fr/bd" target="_blank" rel="noopener noreferrer" className="underline">
          bede.fr
        </a>
        {updatedAt &&
          ` · mis à jour le ${new Date(updatedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            timeZone: "Europe/Paris",
          })}`}
      </p>

      {view === "grid" ? (
        <MonthGrid entries={entries} today={today} allowAdd={false} />
      ) : entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          <p className="text-base font-medium text-foreground">
            {followedOnly ? "Aucune sortie annoncée pour tes séries." : "Aucune sortie BD enregistrée pour le moment."}
          </p>
          <p className="mt-2">
            {followedOnly
              ? "Les prochains tomes de tes séries apparaîtront ici dès que bede.fr les annoncera."
              : "La liste se remplit automatiquement les 1er et 15 de chaque mois."}
          </p>
        </div>
      ) : (
        <EntriesByMonth entries={entries} />
      )}
    </>
  );
}
