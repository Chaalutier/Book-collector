import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bouck",
    short_name: "Bouck",
    description: "Ta bibliothèque et ta wishlist, même sans réseau.",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#6b9080",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Ma wishlist", short_name: "Wishlist", url: "/wishlist" }],
  };
}
