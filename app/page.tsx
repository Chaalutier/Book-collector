import BookSection from "./BookSection";

export default function Home() {
  return (
    <main>
      <h1>Book Collector</h1>
      <p>Ma bibliothèque de livres.</p>

      <BookSection bookCount={42} />
    </main>
  );
}