"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applySync, findMatches } from "@/app/actions/library";
import BookCover from "@/app/components/BookCover";
import { formatContributors, formatDate, formatVolume } from "@/lib/labels";
import {
  SYNC_FIELDS,
  SYNC_LABELS,
  candidateValue,
  defaultSyncFields,
  localValue,
  type SyncField,
} from "@/lib/sync-shared";
import type { Book, BookCandidate } from "@/types/book";

type Scored = BookCandidate & { score: number };

function display(field: SyncField, value: string | null) {
  if (!value) return "—";
  if (field === "published_date") return formatDate(value) ?? value;
  if (field === "cover_url") return "image";
  if (field === "description") return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  return value;
}

export default function SyncPanel({
  userBookId,
  book,
  provisional,
}: {
  userBookId: number;
  book: Book;
  provisional: boolean;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Scored[] | null>(null);
  const [selected, setSelected] = useState<Scored | null>(null);
  const [fields, setFields] = useState<Set<SyncField>>(new Set());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setMessage(null);
      setSelected(null);
      const result = await findMatches(userBookId, query || undefined);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setCandidates(result.data ?? []);
      if ((result.data ?? []).length === 0) {
        setMessage({ ok: false, text: "Rien trouvé pour l'instant. Essaie de préciser la recherche." });
      }
    });

  const choose = (c: Scored) => {
    setSelected(c);
    setFields(new Set(defaultSyncFields({ ...book, provisional }, c)));
    setMessage(null);
  };

  const toggle = (field: SyncField) =>
    setFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });

  const apply = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await applySync(userBookId, selected, [...fields]);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: result.message ?? "Fiche mise à jour." });
      setSelected(null);
      setCandidates(null);
      if (result.data && result.data.userBookId !== userBookId) router.replace(`/library/${result.data.userBookId}`);
      router.refresh();
    });
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Recherche personnalisée (facultatif)"
          className="field min-w-0 flex-1 text-base"
        />
        <button type="button" onClick={search} disabled={pending} className="btn-primary">
          {pending && !selected ? "Recherche…" : "Chercher les infos"}
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.ok ? "text-accent-strong" : "text-red-600"}`}>{message.text}</p>
      )}

      {candidates && !selected && candidates.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-card">
          {candidates.map((c, i) => (
            <li key={c.google_books_id ?? c.bnf_ark ?? c.isbn13 ?? i} className="flex gap-3 p-3">
              <div className="w-14 shrink-0">
                <BookCover src={c.cover_url} title={c.title} isbn={c.isbn13 ?? c.isbn10} />
              </div>
              <div className="min-w-0 flex-1">
                {c.series_title && (
                  <p className="text-xs font-medium text-accent-strong">
                    {c.series_title}
                    {c.volume_number !== null && ` · ${formatVolume(c.volume_number)}`}
                  </p>
                )}
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted">
                  {formatContributors(c.contributors)}
                  {c.published_date && ` · ${formatDate(c.published_date)}`}
                  {c.publisher && ` · ${c.publisher}`}
                </p>
                <button type="button" onClick={() => choose(c)} className="btn-ghost mt-2 px-3 py-1 text-sm">
                  C&apos;est celui-là
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-4 rounded-lg border border-line bg-card p-3">
          <p className="text-sm font-semibold">{selected.title}</p>
          <p className="text-xs text-muted">Coche ce que tu veux reprendre de cette fiche.</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="w-6" />
                <th className="pr-2 font-normal">Info</th>
                <th className="pr-2 font-normal">Actuel</th>
                <th className="font-normal">Trouvé</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {SYNC_FIELDS.map((field) => {
                const next = candidateValue(selected, field);
                const current = localValue(book, field);
                const same = next !== null && next === current;
                return (
                  <tr key={field} className={next ? "" : "opacity-40"}>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={fields.has(field)}
                        disabled={!next || same}
                        onChange={() => toggle(field)}
                        aria-label={SYNC_LABELS[field]}
                      />
                    </td>
                    <td className="py-1.5 pr-2">{SYNC_LABELS[field]}</td>
                    <td className="py-1.5 pr-2 text-muted">{display(field, current)}</td>
                    <td className="py-1.5">{same ? "identique" : display(field, next)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={apply} disabled={pending || fields.size === 0} className="btn-primary">
              {pending ? "Mise à jour…" : "Mettre à jour la fiche"}
            </button>
            <button type="button" onClick={() => setSelected(null)} className="btn-ghost">
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
