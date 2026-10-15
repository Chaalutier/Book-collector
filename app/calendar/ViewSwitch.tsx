"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCalendarView } from "@/app/actions/profile";

type View = "list" | "grid";

const OPTIONS: { value: View; label: string }[] = [
  { value: "list", label: "☰ Liste" },
  { value: "grid", label: "▦ Calendrier" },
];

/** Bascule liste / calendrier ; le choix est enregistré dans le profil de l'utilisateur */
export default function ViewSwitch({ view, source = "mine" }: { view: View; source?: "mine" | "bd" }) {
  const router = useRouter();
  const [current, setCurrent] = useState<View>(view);
  const [, startTransition] = useTransition();

  const choose = (next: View) => {
    if (next === current) return;
    setCurrent(next);
    startTransition(async () => {
      await setCalendarView(next);
      // Garde l'onglet (et le filtre) en cours
      const params = new URLSearchParams(window.location.search);
      params.set("view", next);
      if (source === "bd") params.set("source", "bd");
      router.replace(`/calendar?${params.toString()}`);
    });
  };

  return (
    <div role="group" aria-label="Affichage du calendrier" className="flex overflow-hidden rounded-lg border border-line text-sm">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={current === value}
          className={`px-3 py-1.5 ${current === value ? "bg-accent text-white" : "bg-card hover:bg-soft"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
