"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Bouton d'ajout de la bibliothèque.
 * Sur l'onglet Wishlist, il ajoute directement en wishlist (sans confirmation).
 * Suit l'onglet actif : LibraryView garde le filtre dans l'URL (?status=…).
 */
export default function AddBookButton() {
  const isWishlist = useSearchParams().get("status") === "wishlist";

  return (
    <Link href={isWishlist ? "/search?to=wishlist" : "/search"} className="btn-primary">
      {isWishlist ? "♡ Ajouter à ma wishlist" : "+ Ajouter un livre"}
    </Link>
  );
}
