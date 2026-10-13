"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applySync } from "@/app/actions/library";
import { SYNC_LABELS, type SyncField } from "@/lib/sync-shared";
import type { BookCandidate } from "@/types/book";

export default function QuickApply({
  userBookId,
  candidate,
  fields,
}: {
  userBookId: number;
  candidate: BookCandidate;
  fields: SyncField[];
}) {
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) return <p className="mt-2 text-sm text-accent-strong">✓ {done}</p>;

  const apply = () =>
    startTransition(async () => {
      setError(null);
      const result = await applySync(userBookId, candidate, fields);
      if (!result.ok) return setError(result.error);
      setDone(result.message ?? "Fiche mise à jour.");
      router.refresh();
    });

  return (
    <div className="mt-2">
      <p className="text-[11px] text-muted">Reprendre : {fields.map((f) => SYNC_LABELS[f].toLowerCase()).join(", ")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={apply} disabled={pending || fields.length === 0} className="btn-primary px-3 py-1 text-sm">
          {pending ? "Mise à jour…" : "Appliquer"}
        </button>
        <Link href={`/library/${userBookId}#completer`} className="text-sm underline">
          Choisir les infos
        </Link>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
