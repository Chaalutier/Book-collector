"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePublisher } from "@/app/actions/publisher";
import type { ActionResult } from "@/app/actions/library";
import { ORIGINS } from "@/lib/origin";
import type { PublisherInfo } from "@/lib/publishers";

export default function EditForm({ name, info, bookCount }: { name: string; info: PublisherInfo | null; bookCount: number }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePublisher, null);

  return (
    <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="original" value={name} />

      <label className="text-sm sm:col-span-2">
        Nom
        <input name="name" required defaultValue={name} maxLength={200} className="field mt-1 text-base" />
        <span className="mt-1 block text-[11px] text-muted">
          Changer le nom le corrige sur les {bookCount} livre{bookCount > 1 ? "s" : ""} du catalogue qui portent
          celui-ci. Si une autre fiche porte déjà ce nom, les deux sont fusionnées.
        </span>
      </label>

      <label className="text-sm">
        Origine
        <input name="country" list="publisher-countries" defaultValue={info?.country ?? ""} maxLength={60} placeholder="ex. Française, Japonaise…" className="field mt-1" />
        <datalist id="publisher-countries">
          {ORIGINS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </label>

      <label className="text-sm">
        Groupe
        <input name="parent_group" defaultValue={info?.parent_group ?? ""} maxLength={120} placeholder="ex. Hachette Livre" className="field mt-1" />
      </label>

      <label className="text-sm sm:col-span-2">
        Site web
        <input name="website" type="url" defaultValue={info?.website ?? ""} maxLength={300} placeholder="https://…" className="field mt-1" />
      </label>

      <label className="text-sm sm:col-span-2">
        Description / notes
        <textarea name="description" rows={4} defaultValue={info?.description ?? ""} maxLength={2000} className="field mt-1" />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Link href={`/publishers/${encodeURIComponent(name)}`} className="text-sm text-muted hover:text-foreground">
          Annuler
        </Link>
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
