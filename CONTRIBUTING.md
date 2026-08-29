# Contributing

Thanks for wanting to help. Unseen is a local Next.js app: official watch-history
exports in, TMDB / JustWatch catalogs in, unseen movies out.

## Before you start

- Read the [README](README.md) for setup and the [code of conduct](CODE_OF_CONDUCT.md).
- Open an issue first for large features or new streaming services. Small bug
  fixes and docs can go straight to a pull request.
- Do not commit personal watch history, `auth.json`, `.env`, `.auth/`, or SQLite
  files. Keep real exports on your machine only.

## Development setup

You need **Node.js 22.5+** (`node:sqlite` is built in). Playwright Chromium is
only required for the official Netflix download tests and the optional sign-in
CLI.

```bash
npm install
npx playwright install chromium
cp auth.example.json auth.json   # paste a TMDB key, or use the Setup screen
cp .env.example .env             # optional OMDB_API_KEY
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Load sample catalog** on
Setup lets you click through the UI without a TMDB key.

## Checks

Run these before you open a PR:

```bash
npm test
npm run lint
npm run typecheck
```

CI runs the same commands. The Playwright tests launch headless Chromium against
local HTML fixtures; they do not talk to Netflix.

## Project conventions

- Catalogs come from TMDB / JustWatch. Do not scrape streamer sites.
- Watch history comes from official exports (Netflix **Download all** CSV,
  Amazon Prime Video privacy ZIP). Do not add unofficial history endpoints.
- Watched titles are global by TMDB id. A match on one service hides the movie
  everywhere.
- Prefer tests next to the module (`src/lib/*.test.ts`) over new test folders.
- Keep changes narrow. The Next.js version in this repo has breaking APIs;
  read `node_modules/next/dist/docs/` before adding routes or server code.

## Pull requests

- One concern per PR when you can.
- Say what you verified (`npm test`, a Setup/Unseen click-through, etc.).
- If you touch matching, CSV parsing, or export, add or update a fixture-backed
  test.
