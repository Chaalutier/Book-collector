"use client";

import { useOptimistic, useTransition } from "react";
import { updateStatus } from "@/app/actions/library";
import { STATUS_DESCRIPTIONS, STATUS_STYLES } from "@/lib/labels";
import { READING_STATUSES, type ReadingStatus } from "@/types/book";

/** Menu de statut qui enregistre immédiatement */
export default function StatusSelect({
  userBookId,
  status,
}: {
  userBookId: number;
  status: ReadingStatus;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Statut de lecture"
      value={optimisticStatus}
      disabled={pending}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value as ReadingStatus;
        startTransition(async () => {
          setOptimisticStatus(next);
          const result = await updateStatus(userBookId, next);
          if (!result.ok) alert(result.error);
        });
      }}
      className={`w-full cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_STYLES[optimisticStatus]}`}
    >
      {READING_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-card text-foreground">
          {STATUS_DESCRIPTIONS[s]}
        </option>
      ))}
    </select>
  );
}
