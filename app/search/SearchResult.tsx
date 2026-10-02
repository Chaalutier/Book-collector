"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addBook, previewBook } from "@/app/actions/library";
import BookCover from "@/app/components/BookCover";
import {
  CATEGORY_LABELS,
  STATUS_DESCRIPTIONS,
  formatContributors,
  formatDate,
  formatVolume,
} from "@/lib/labels";
import {
  BOOK_CATEGORIES,
  READING_STATUSES,
  type BookCandidate,
  type BookCategory,
  type ReadingStatus,
} from "@/types/book";

type Step = "idle" | "review" | "added";

export default function SearchResult({
  candidate,
  ownedUserBookId,
  quickStatus,
}: {
  candidate: BookCandidate;
  ownedUserBookId: number | null;
  /** Ajout en un clic avec ce statut, sans écran de confirmation (ex. depuis la wishlist) */
  quickStatus?: ReadingStatus;
}) {
  const [step, setStep] = useState<Step>(ownedUserBookId ? "added" : "idle");
  const [draft, setDraft] = useState<BookCandidate>(candidate);
  const [status, setStatus] = useState<ReadingStatus>("to_read");
  const [userBookId, setUserBookId] = useState<number | null>(ownedUserBookId);
  const [error, setError] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState("✓ Dans ta bibliothèque");
  const [pending, startTransition] = useTransition();

  // Catégorie proposée par la détection automatique (Google, puis Google + BnF)
  const [detected, setDetected] = useState({
    category: candidate.category,
    reasons: candidate.category_reasons ?? [],
  });
  const volume = formatVolume(draft.volume_number);
  const published = formatDate(draft.published_date);

  const startReview = () =>
    startTransition(async () => {
      setError(null);
      const result = await previewBook(candidate);
      if (!result.ok) return setError(result.error);
      if (result.data) {
        setDraft(result.data);
        setDetected({ category: result.data.category, reasons: result.data.category_reasons ?? [] });
      }
      setStep("review");
    });

  // Ajout direct : enrichissement BnF (série, tome, catégorie) puis enregistrement
  const quickAdd = (target: ReadingStatus) =>
    startTransition(async () => {
      setError(null);
      const preview = await previewBook(candidate);
      const book = preview.ok && preview.data ? preview.data : candidate;
      setDraft(book);
      const result = await addBook(book, target);
      if (!result.ok) return setError(result.error);
      setUserBookId(result.data?.userBookId ?? null);
      setAddedMessage(
        result.data?.alreadyInLibrary
          ? "✓ Déjà dans ta bibliothèque"
          : target === "wishlist"
            ? "♡ Ajouté à ta wishlist"
            : "✓ Ajouté"
      );
      setStep("added");
    });

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await addBook(draft, status);
      if (!result.ok) return setError(result.error);
      setUserBookId(result.data?.userBookId ?? null);
      setStep("added");
    });

  return (
    <div className="flex gap-4">
      <div className="w-20 shrink-0 sm:w-24">
        <BookCover src={draft.cover_url} title={draft.title} />
      </div>

      <div className="min-w-0 flex-1">
        {draft.series_title && (
          <p className="text-xs font-medium text-accent-strong">
            {draft.series_title}
            {volume && ` · ${volume}`}
          </p>
        )}
        <h2 className="font-semibold">{draft.title}</h2>
        {draft.subtitle && <p className="text-sm text-muted">{draft.subtitle}</p>}
        <p className="text-sm text-muted">
          {formatContributors(draft.contributors, { withRoles: step === "review" })}
          {published && ` · ${published}`}
          {draft.publisher && ` · ${draft.publisher}`}
        </p>
        <p className="mt-1 text-xs text-muted">
          <span
            title={detected.reasons.length ? `Détecté : ${detected.reasons.join(", ")}` : undefined}
            className="rounded bg-soft px-1.5 py-0.5 font-medium text-accent-strong"
          >
            {CATEGORY_LABELS[draft.category]}
          </span>
          {draft.page_count && ` · ${draft.page_count} p.`}
          {draft.isbn13 && ` · ISBN ${draft.isbn13}`}
        </p>

        {step === "idle" &&
          (quickStatus ? (
            <button onClick={() => quickAdd(quickStatus)} disabled={pending} className="btn-primary mt-3">
              {pending
                ? "Ajout…"
                : quickStatus === "wishlist"
                  ? "♡ Ajouter à la wishlist"
                  : "Ajouter"}
            </button>
          ) : (
            <button onClick={startReview} disabled={pending} className="btn-primary mt-3">
              {pending ? "Recherche des détails…" : "Ajouter"}
            </button>
          ))}

        {step === "review" && (
          <div className="mt-3 grid gap-3 rounded-lg border border-line bg-card p-3 sm:grid-cols-2">
            <label className="text-xs">
              Catégorie
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as BookCategory })}
                className="field mt-1"
              >
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              {draft.category === detected.category && detected.reasons.length > 0 && (
                <span className="mt-1 block text-[11px] text-muted">
                  Détecté automatiquement : {detected.reasons.join(" · ")}
                </span>
              )}
            </label>

            <label className="text-xs">
              Statut
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReadingStatus)}
                className="field mt-1"
              >
                {READING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DESCRIPTIONS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs">
              Série
              <input
                value={draft.series_title ?? ""}
                onChange={(e) => setDraft({ ...draft, series_title: e.target.value || null })}
                placeholder="Aucune (one-shot)"
                className="field mt-1"
              />
            </label>

            <label className="text-xs">
              Tome
              <input
                inputMode="decimal"
                value={draft.volume_number ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  setDraft({
                    ...draft,
                    volume_number: e.target.value === "" || Number.isNaN(n) ? null : n,
                  });
                }}
                placeholder="—"
                className="field mt-1"
              />
            </label>

            <div className="flex gap-2 sm:col-span-2">
              <button onClick={confirm} disabled={pending} className="btn-primary">
                {pending ? "Ajout…" : "Confirmer l'ajout"}
              </button>
              <button onClick={() => setStep("idle")} disabled={pending} className="btn-ghost">
                Annuler
              </button>
            </div>
          </div>
        )}

        {step === "added" && (
          <p className="mt-3 text-sm text-accent-strong">
            {addedMessage}
            {userBookId && (
              <>
                {" · "}
                <Link href={`/library/${userBookId}`} className="underline">
                  voir la fiche
                </Link>
              </>
            )}
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
