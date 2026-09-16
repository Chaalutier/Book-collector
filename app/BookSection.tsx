export default function BookSection({
  books,
}: {
  books: any[];
}) {
  return (
    <section>
      <h2>Mes livres</h2>

      <p>Découvre, organise et garde une trace de tes lectures</p>

      <label htmlFor="site-search">Rechercher sur le site :</label>
      <input type="search" id="site-search" name="q" />
      <button>Rechercher</button>

      {books.map((book) => (
        <div key={book.id}>
          <h3>{book.title}</h3>
          <p>{book.author}</p>
        </div>
      ))}
    </section>
  );
}