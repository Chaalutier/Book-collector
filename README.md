# Bouck

Gestion de ma bibliothèque : romans, essais, mangas et BD.

- Catalogue partagé : livres, **séries** et **tomes**, **plusieurs auteurs** avec leur rôle (scénario, dessin, traduction…)
- Bibliothèque perso : statut (wishlist, acheté à lire, en cours, lu, abandonné), note, notes, dates de lecture
- Vue par série avec détection des tomes manquants
- Recherche via **Google Books** + enrichissement **BnF** (série, n° de tome, auteurs), gratuits
- Profil : photo, nom affiché, description, statistiques

Stack : Next.js 16 (App Router, Server Actions), React 19, Tailwind 4, Supabase (Auth, Postgres, Storage).

## Installation

### 1. Variables d'environnement (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Optionnel mais recommandé : sans clé, Google Books limite vite (erreurs 429)
GOOGLE_BOOKS_API_KEY=AIza...
```

Clé Google Books gratuite (1 000 requêtes/jour) :
[console.cloud.google.com](https://console.cloud.google.com/) → nouveau projet →
« API et services » → activer **Books API** → « Identifiants » → **Créer une clé API**.

La BnF ne demande pas de clé.

### 2. Base de données

Ouvrir Supabase → **SQL Editor**, coller le contenu de
`supabase/migrations/20261001000000_bibliotheque_v2.sql` et exécuter.

⚠️ Ce script **repart de zéro** : il supprime les anciennes tables `books` et `user_books`.
Les comptes utilisateurs sont conservés. Il crée aussi le bucket Storage `avatars`.

### 3. Lancer

```bash
npm install
npm run dev
```

## Modèle de données

| Table               | Rôle                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `profiles`          | nom affiché, bio, photo (1 ligne par utilisateur, créée auto)      |
| `authors`           | personnes (auteur, scénariste, dessinateur…)                       |
| `series`            | série (titre, catégorie, nb de tomes parus, terminée ?)            |
| `books`             | une édition (ISBN), sa catégorie, sa série et son n° de tome        |
| `book_contributors` | lien livre ↔ auteur avec le rôle                                   |
| `user_books`        | livre dans MA bibliothèque : statut, note, notes, dates            |

L'ajout d'un livre passe par la fonction SQL `add_book_to_library(p_book, p_status)` :
dédoublonnage par ISBN, création de la série et des auteurs, en une transaction.

## Organisation du code

```
app/
  actions/          Server Actions (ajout, statut, fiche, série, profil)
  library/          ma bibliothèque, fiche d'un livre, page série
  search/           recherche + ajout
  profile/          profil
  components/       BookCard, BookCover, StatusSelect, Avatar, navbar
lib/
  catalog/          Google Books, BnF, fusion des résultats
  library.ts        lecture de la bibliothèque depuis Supabase
  labels.ts         libellés FR (catégories, statuts, rôles)
supabase/migrations SQL à exécuter dans Supabase
types/book.ts       types partagés
```
