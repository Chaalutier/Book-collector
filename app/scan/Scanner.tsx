"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addBook, lookupIsbn } from "@/app/actions/library";
import BookCover from "@/app/components/BookCover";
import BookLoader from "@/app/components/BookLoader";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLES, formatContributors, formatVolume } from "@/lib/labels";
import { READING_STATUSES, type BookCandidate, type ReadingStatus } from "@/types/book";

type Phase =
  | { kind: "scanning" }
  | { kind: "loading"; isbn: string }
  | { kind: "found"; candidate: BookCandidate; ownedUserBookId: number | null }
  | { kind: "notfound"; isbn: string }
  | { kind: "added"; candidate: BookCandidate; userBookId: number | null; status: ReadingStatus }
  | { kind: "error"; message: string };

/** Un code EAN-13 de livre commence par 978 ou 979 et sa clé de contrôle doit être juste */
function validIsbn13(code: string): boolean {
  if (!/^97[89]\d{10}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

export default function Scanner({ initialStatus }: { initialStatus: ReadingStatus }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [status, setStatus] = useState<ReadingStatus>(initialStatus);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [session, setSession] = useState<{ title: string; status: ReadingStatus }[]>([]);
  const [pending, startTransition] = useTransition();

  const lookup = useCallback((isbn: string) => {
    pausedRef.current = true;
    setPhase({ kind: "loading", isbn });
    navigator.vibrate?.(40);
    lookupIsbn(isbn).then((result) => {
      if (!result.ok) return setPhase({ kind: "error", message: result.error });
      const data = result.data;
      if (!data?.candidate && !data?.ownedUserBookId) return setPhase({ kind: "notfound", isbn });
      if (data?.candidate) {
        setPhase({ kind: "found", candidate: data.candidate, ownedUserBookId: data.ownedUserBookId ?? null });
      } else {
        setPhase({ kind: "error", message: "Ce livre est déjà dans ta bibliothèque." });
      }
    }).catch(() => setPhase({ kind: "error", message: "Recherche impossible pour le moment." }));
  }, []);

  const onCode = useCallback(
    (raw: string) => {
      const code = raw.replace(/\D/g, "");
      if (pausedRef.current || !validIsbn13(code)) return;
      const now = Date.now();
      if (lastRef.current.code === code && now - lastRef.current.at < 3000) return;
      lastRef.current = { code, at: now };
      lookup(code);
    },
    [lookup]
  );

  // Caméra + lecture : détecteur natif si le navigateur en a un, ZXing sinon (iPhone)
  useEffect(() => {
    let cancelled = false;
    let stopDecoding: (() => void) | null = null;
    let stream: MediaStream | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "La caméra n'est pas accessible ici : elle demande une connexion sécurisée (https) et un navigateur récent. Tu peux saisir l'ISBN à la main."
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        setCameraError("Accès à la caméra refusé. Autorise-la dans les réglages du navigateur, ou saisis l'ISBN à la main.");
        return;
      }
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (Native) {
        const detector = new Native({ formats: ["ean_13"] });
        let timer: ReturnType<typeof setTimeout>;
        const tick = async () => {
          if (cancelled) return;
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              if (codes[0]) onCode(codes[0].rawValue);
            } catch {
              /* image illisible : on réessaie */
            }
          }
          timer = setTimeout(tick, 150);
        };
        tick();
        stopDecoding = () => clearTimeout(timer);
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) onCode(result.getText());
        });
        stopDecoding = () => controls.stop();
      }
    }

    start().catch((error) => {
      console.error(error);
      setCameraError("Impossible de démarrer le scan. Tu peux saisir l'ISBN à la main.");
    });

    return () => {
      cancelled = true;
      stopDecoding?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const rescan = () => {
    pausedRef.current = false;
    lastRef.current = { code: "", at: Date.now() }; // laisse 3 s avant de relire le même code
    setPhase({ kind: "scanning" });
  };

  const add = () => {
    if (phase.kind !== "found") return;
    const { candidate } = phase;
    startTransition(async () => {
      const result = await addBook(candidate, status);
      if (!result.ok) return setPhase({ kind: "error", message: result.error });
      setSession((list) => [{ title: candidate.title, status }, ...list]);
      setPhase({ kind: "added", candidate, userBookId: result.data?.userBookId ?? null, status });
    });
  };

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const code = manual.replace(/[\s-]/g, "");
    if (!validIsbn13(code)) {
      return setPhase({ kind: "error", message: "ISBN invalide (13 chiffres commençant par 978 ou 979)." });
    }
    setManual("");
    lookup(code);
  };

  return (
    <div className="mt-5">
      {/* Caméra */}
      <div className="relative overflow-hidden rounded-xl bg-black">
        {cameraError ? (
          <p className="p-6 text-sm text-white">{cameraError}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            {/* cadre de visée */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {phase.kind !== "scanning" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
                {phase.kind === "loading" ? <BookLoader scale={0.6} label="Recherche du livre…" className="!py-0 [--book-loader-color:#fff] [--book-loader-text:#fff]" /> : "Scan en pause"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Statut choisi avant l'ajout */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Statut des livres scannés</p>
        <div className="flex flex-wrap gap-2">
          {READING_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                status === s ? "bg-accent text-accent-foreground" : "border border-line bg-white text-muted"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Résultat */}
      {phase.kind === "found" && (
        <section className="mt-5 rounded-xl border border-line bg-card p-4">
          <BookLine candidate={phase.candidate} />
          {phase.ownedUserBookId ? (
            <p className="mt-3 text-sm">
              ✓ Déjà dans ta bibliothèque.{" "}
              <Link href={`/library/${phase.ownedUserBookId}`} className="underline">
                Voir la fiche
              </Link>
            </p>
          ) : (
            <button onClick={add} disabled={pending} className="btn-primary mt-4 w-full justify-center">
              {pending ? "Ajout…" : `Ajouter (${STATUS_LABELS[status]})`}
            </button>
          )}
          <button onClick={rescan} className="btn-ghost mt-2 w-full justify-center">
            Ce n&apos;est pas le bon livre / suivant
          </button>
        </section>
      )}

      {phase.kind === "added" && (
        <section className="mt-5 rounded-xl border border-line bg-card p-4">
          <p className="font-medium">✓ Ajouté — {STATUS_LABELS[phase.status]}</p>
          <div className="mt-3">
            <BookLine candidate={phase.candidate} />
          </div>
          <button onClick={rescan} className="btn-primary mt-4 w-full justify-center">
            Scanner le suivant
          </button>
          {phase.userBookId && (
            <Link href={`/library/${phase.userBookId}`} className="mt-2 block text-center text-sm underline">
              Voir la fiche (corriger série, tome…)
            </Link>
          )}
        </section>
      )}

      {phase.kind === "notfound" && (
        <section className="mt-5 rounded-xl border border-dashed border-line p-4 text-sm">
          <p className="font-medium">Aucun livre trouvé pour l&apos;ISBN {phase.isbn}.</p>
          <p className="mt-1 text-muted">Les catalogues ne le connaissent pas (ou ne répondent pas pour le moment).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={rescan} className="btn-primary">
              Réessayer / suivant
            </button>
            <Link href={`/search?q=${phase.isbn}`} className="btn-ghost">
              Chercher à la main
            </Link>
          </div>
        </section>
      )}

      {phase.kind === "error" && (
        <section className="mt-5 rounded-xl border border-line bg-[#f6e4e4] p-4 text-sm text-[#8a4848]">
          <p>{phase.message}</p>
          <button onClick={rescan} className="btn-ghost mt-3 bg-white">
            Continuer à scanner
          </button>
        </section>
      )}

      {/* Saisie manuelle */}
      <form onSubmit={submitManual} className="mt-6 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="ISBN à saisir (978…)"
          className="field"
          aria-label="ISBN"
        />
        <button type="submit" className="btn-ghost">
          OK
        </button>
      </form>

      {/* Livres ajoutés pendant cette séance */}
      {session.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Ajoutés pendant ce scan ({session.length})</h2>
          <ul className="space-y-1 text-sm">
            {session.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{item.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/library" className="mt-3 inline-block text-sm underline">
            Voir ma bibliothèque
          </Link>
        </section>
      )}
    </div>
  );
}

function BookLine({ candidate }: { candidate: BookCandidate }) {
  const volume = formatVolume(candidate.volume_number);
  return (
    <div className="flex gap-3">
      <div className="w-16 shrink-0">
        <BookCover src={candidate.cover_url} title={candidate.title} isbn={candidate.isbn13 ?? candidate.isbn10} />
      </div>
      <div className="min-w-0">
        {candidate.series_title && (
          <p className="text-xs font-medium text-accent-strong">
            {candidate.series_title}
            {volume && ` · ${volume}`}
          </p>
        )}
        <p className="font-semibold">{candidate.title}</p>
        <p className="text-sm text-muted">
          {formatContributors(candidate.contributors)}
          {candidate.publisher && ` · ${candidate.publisher}`}
        </p>
        <p className="mt-1 text-xs text-muted">
          {CATEGORY_LABELS[candidate.category]}
          {candidate.isbn13 && ` · ISBN ${candidate.isbn13}`}
        </p>
      </div>
    </div>
  );
}
