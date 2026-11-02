"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Revient à la page précédente ; sans historique (onglet ouvert directement), va sur `href` */
export default function BackLink({ href, className }: { href: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (window.history.length <= 1) return;
        e.preventDefault();
        router.back();
      }}
    >
      ← Retour
    </Link>
  );
}
