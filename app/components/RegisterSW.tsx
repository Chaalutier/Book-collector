"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (copie hors ligne de la wishlist) en production uniquement,
 * et lui confie les fichiers de l'appli déjà chargés pour qu'ils soient dispo sans réseau.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((name) => new URL(name).origin === location.origin && new URL(name).pathname.startsWith("/_next/static/"));
        registration.active?.postMessage({ type: "precache", urls });
      })
      .catch((error) => console.error("Service worker :", error));
  }, []);

  return null;
}
