# citybook

Personal city guide: a map of favourite places (covered passages, museums, beautiful streets), adventures to plan for friends who visit, and a read-only link to share each plan. Starting with Paris.

The site is in English for now; every interface text lives in `src/i18n/en.js`, so a French version only needs a `fr.js` with the same keys.

## How it is built

| Part | Where | What |
|---|---|---|
| Pages | `*.html`, `src/` | Plain JavaScript built by Vite. Map with Leaflet and CARTO/OpenStreetMap tiles. |
| API | `worker/` | One Cloudflare Worker: JSON API, sign-in, photos. |
| Data | D1 database `citybook` | Places, opening hours, photos, events, adventures, users. **Editable data lives here, not in the code.** |
| Files | R2 bucket `citybook-photos` | Cached Wikimedia photos (public) and adventure covers (private). |

```
migrations/      database schema, one numbered file per change (never edit an applied one)
seed/paris.json  starting list of places, imported once (see below)
scripts/         seed-to-sql (JSON → SQL) and create-user (prints a hashed account)
src/lib/         shared code: hours, i18n, .ics export, scrapbook UI pieces
src/pages/       one script per page
src/styles/      base.css (palette, paper, cut-out letters) + one file per page
worker/          index.js (routes), auth, places, adventures, photos
tests/           node --test
```

### Design

A tidy scrapbook: gingham and dotted paper, cut-out letter titles, polaroids held by washi tape. Decoration stays in headers and margins; content always sits on calm paper. Each page has its own palette (`data-palette` on `<body>`): map green & yellow, adventures blue & yellow.

### Security

- Passwords hashed with PBKDF2-SHA256 (100 000 iterations, random salt). Sessions are random tokens in an `HttpOnly; Secure; SameSite=Lax` cookie; only their SHA-256 is stored.
- Every API route checks the user, and every adventure query checks its owner, so more people can be invited later without changing the data model.
- Writes from another site are refused (`Origin` check).
- Share links are long random tokens and can be revoked. Adventure covers are private: only the owner or a share-link holder can see them.
- Uploaded covers are checked by their first bytes (JPEG, PNG, WebP only, 8 MB max).

## Work on it

```sh
npm install
npm test                 # unit tests
npm run build            # front end into dist/
npm run db:migrate:local # local database
node scripts/create-user.mjs you@example.com "Name" > user.sql
npx wrangler d1 execute citybook --local --file=user.sql
npm run db:seed:local
npm run preview          # build + wrangler dev on http://localhost:8787
```

## Deploy

Pushing to `main` redeploys through Cloudflare Workers Builds (build command `npm run build`, deploy command `npx wrangler deploy`).

**Database changes**: add `migrations/000N_what.sql`, test locally, then apply online with `npx wrangler d1 migrations apply citybook --remote`.

**Create an account** (the password stays on your computer):
```sh
node scripts/create-user.mjs you@example.com "Name"
```
Paste the printed `insert` into Cloudflare → D1 → citybook → Console.

## Data

- Coordinates and photos: [Wikidata](https://www.wikidata.org) and [Wikimedia Commons](https://commons.wikimedia.org) (each photo is credited on the map). Street and passage lines: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
- `seed/paris.json` is only the starting list. Run `npm run seed:sql` and load `seed/seed.sql` once; it uses `insert or ignore`, so it never overwrites changes made on the site.
- Opening hours start with `hours_verified = 0` and the map says "to double-check" until they are confirmed.
