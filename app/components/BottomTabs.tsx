"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const TABS = [
  {
    href: "/library",
    label: "Biblio",
    match: (p: string) => p.startsWith("/library") || p.startsWith("/authors") || p.startsWith("/publishers"),
    icon: icon(<><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 7h6" /></>),
  },
  {
    href: "/library?status=wishlist",
    label: "Wishlist",
    match: () => false,
    badge: true,
    icon: icon(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />),
  },
  {
    href: "/search",
    label: "Ajouter",
    match: (p: string) => p.startsWith("/search"),
    primary: true,
    icon: icon(<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  },
  {
    href: "/discover",
    label: "Découvrir",
    match: (p: string) => p.startsWith("/discover"),
    icon: icon(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>),
  },
  {
    href: "/calendar",
    label: "Sorties",
    match: (p: string) => p.startsWith("/calendar"),
    icon: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>),
  },
];

/** Barre d'onglets fixée en bas de l'écran sur mobile */
export default function BottomTabs({ wishlistCount }: { wishlistCount: number }) {
  const pathname = usePathname();

  return (
    <>
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href} className="flex justify-center">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-w-14 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] ${
                    tab.primary
                      ? "text-accent-strong"
                      : active
                        ? "font-semibold text-accent-strong"
                        : "text-muted"
                  }`}
                >
                  <span
                    className={
                      tab.primary
                        ? "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow"
                        : ""
                    }
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                  {tab.badge && wishlistCount > 0 && (
                    <span className="absolute top-0 right-1 min-w-4 rounded-full bg-[#f6e4e4] px-1 text-center text-[10px] font-medium text-[#8a4848] tabular-nums">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
