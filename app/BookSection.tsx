export default function BookSection({ bookCount }: {bookCount: number}) {
    return (
        <main>
            <section>
                <h2>
                    Mes livres
                </h2>
                <p>Découvre, organise et garde une trace de tes lectures</p>
                <label htmlFor="site-search">Rechercher sur le site :</label>
                <input type="search" id="site-search" name="q" />
                <button>Rechercher</button>
                <p>Tu as actuellement {bookCount} livres</p>
            </section>
        </main>
    )
}