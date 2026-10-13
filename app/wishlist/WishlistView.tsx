"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { detectOrigins } from "@/app/actions/origin";
import { formatDate } from "@/lib/labels";
import { isUpcoming } from "@/lib/calendar-shared";
import type { WishGroup, WishItem } from "@/lib/wishlist";

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function matches(item: WishItem, q: string) {
  if (!q) return true;
  const haystack = plain([item.title, item.series, item.origin, ...item.authors.map((a) => a.name)].join(" "));
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

function MiniCover({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="h-[54px] w-9 shrink-0 rounded bg-line" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniature légère, domaines externes variés
    <img
      src={src}
      alt=""
      title={title}
      width={36}
      height={54}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-[54px] w-9 shrink-0 rounded bg-line object-cover"
    />
  );
}

function Row({ item, muted }: { item: WishItem; muted?: boolean }) {
  const upcoming = isUpcoming(item.date);
  return (
    <li>
      <Link
        href={`/library/${item.id}`}
        className={`flex items-center gap-3 py-2 active:bg-soft ${muted ? "opacity-70" : ""}`}
      >
        <MiniCover src={item.cover} title={item.title} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">
            {item.volume !== null && <span className="text-accent-strong">T.{String(item.volume).replace(".", ",")} · </span>}
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {item.authors.length ? item.authors.map((a) => a.name).join(", ") : "Auteur inconnu"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {item.origin && (
            <span
              title={item.originGuess ? "Déduit de la catégorie (manga)" : "Origine de l'auteur"}
              className={`rounded-full bg-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong ${item.originGuess ? "opacity-70" : ""}`}
            >
              {item.origin}
            </span>
          )}
          {upcoming && item.date && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-[#76561a]">
              Sort {formatDate(item.date)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function Groups({ groups, query, muted }: { groups: WishGroup[]; query: string; muted?: boolean }) {
  return (
    <>
      {groups.map((group) => {
        const items = group.items.filter((i) => matches(i, query));
        if (items.length === 0) return null;
        return (
          <section key={group.key} className="mt-4">
            <h2 className="sticky top-0 z-10 flex items-baseline justify-between bg-background/95 py-1 text-sm font-semibold backdrop-blur">
              <span>{group.title ?? "Livres seuls"}</span>
              <span className="text-xs font-normal text-muted">{items.length}</span>
            </h2>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <Row key={item.id} item={item} muted={muted} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export default function WishlistView({
  wanted,
  ordered,
  generatedAt,
  authorsWithoutOrigin,
}: {
  wanted: WishGroup[];
  ordered: WishGroup[];
  generatedAt: string;
  authorsWithoutOrigin: number[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);
  const [detecting, startDetect] = useTransition();
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  // Page possiblement servie depuis la copie du téléphone : on le signale
  useEffect(() => {
    setOnline(navigator.onLine);
    setStale(Date.now() - new Date(generatedAt).getTime() > 2 * 60 * 1000);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [generatedAt]);

  const q = plain(query.trim());
  const total = wanted.reduce((n, g) => n + g.items.length, 0);
  const shown = useMemo(
    () => wanted.reduce((n, g) => n + g.items.filter((i) => matches(i, q)).length, 0),
    [wanted, q]
  );
  const orderedShown = ordered.reduce((n, g) => n + g.items.filter((i) => matches(i, q)).length, 0);

  const detect = () =>
    startDetect(async () => {
      setDetectMessage(null);
      const result = await detectOrigins(authorsWithoutOrigin);
      if (!result.ok) return setDetectMessage(result.error);
      const { found = 0, missed = 0 } = result.data ?? {};
      setDetectMessage(`${found} origine${found > 1 ? "s" : ""} trouvée${found > 1 ? "s" : ""}${missed ? `, ${missed} à renseigner à la main (page de l'auteur)` : ""}.`);
      router.refresh();
    });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Wishlist</h1>
          <p className="text-xs text-muted">
            {total} livre{total > 1 ? "s" : ""} à acheter
          </p>
        </div>
        <Link href="/search?to=wishlist" className="btn-primary px-3 py-1.5 text-sm">
          + Ajouter
        </Link>
      </div>

      {(!online || stale) && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs" role="status">
          {online ? "Liste affichée depuis la copie du téléphone" : "Hors ligne"} — enregistrée le{" "}
          {new Date(generatedAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          .
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher un titre, un auteur, une série…"
        aria-label="Filtrer la wishlist"
        className="field mt-3 text-base"
      />

      {total === 0 ? (
        <p className="mt-10 text-center text-muted">Ta wishlist est vide.</p>
      ) : shown === 0 && q ? (
        <p className="mt-10 text-center text-muted">
          Pas dans ta wishlist{orderedShown > 0 ? " — mais déjà commandé, voir plus bas" : ""}.
        </p>
      ) : (
        <Groups groups={wanted} query={q} />
      )}

      {orderedShown > 0 && (
        <details open={!!q} className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            Déjà commandés, à recevoir ({orderedShown})
          </summary>
          <Groups groups={ordered} query={q} muted />
        </details>
      )}

      {authorsWithoutOrigin.length > 0 && online && (
        <div className="mt-8 rounded-lg border border-dashed border-line p-3 text-center text-xs text-muted">
          <button type="button" onClick={detect} disabled={detecting} className="btn-ghost px-3 py-1 text-xs">
            {detecting ? "Recherche…" : "Détecter les origines des auteurs"}
          </button>
          {detectMessage && <p className="mt-2">{detectMessage}</p>}
        </div>
      )}
    </main>
  );
}
