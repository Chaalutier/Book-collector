import BookLoader from "@/app/components/BookLoader";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <BookLoader label="Recherche en cours…" />
    </main>
  );
}
