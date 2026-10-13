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
export default function ViewSwitch({ view }: { view: View }) {
  const router = useRouter();
  const [current, setCurrent] = useState<View>(view);
  const [, startTransition] = useTransition();

  const choose = (next: View) => {
    if (next === current) return;
    setCurrent(next);
    startTransition(async () => {
      await setCalendarView(next);
      router.replace(next === "grid" ? "/calendar?view=grid" : "/calendar?view=list");
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
