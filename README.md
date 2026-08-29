# Unseen on Netflix

Local web app that subtracts your official Netflix viewing-activity CSV from cached US catalogs for Netflix, Prime Video, Disney+, and HBO Max (TMDB + JustWatch).

It does not scrape streaming sites or hidden viewing-activity endpoints. Catalogs come from TMDB. Watch history comes from Netflix’s official **Download all** CSV and Amazon’s official Prime Video privacy ZIP.

## Setup

1. Copy `auth.example.json` to `auth.json`, or paste a key on the Setup screen.
2. Create a free [TMDB API key](https://www.themoviedb.org/settings/api) and put it in `tmdbApiKey`. A v4 read-access token also works. `auth.json` is gitignored.
3. Optional: put an [OMDb](https://www.omdbapi.com/) API key in `.env` as `OMDB_API_KEY`. After catalogs are cached, click **Fetch Metascores** on Setup. Titles with fewer than 100 IMDb votes are treated as unrated.
4. Install and run:

```bash
npm install
npx playwright install chromium
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Netflix sign-in (once)

Same pattern as Job Assistant’s LinkedIn auth: headed Chrome, you finish login / 2FA, session is saved to gitignored `.auth/netflix.json`. No password is passed to the CLI.

```bash
npm run auth:netflix
```

Pick the Netflix profile you want tracked. To attach to Chrome you start yourself:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.chrome-cdp-netflix"
npm run auth:netflix -- --existing
```

## Use

1. On Setup, click **Refresh watch history**. The saved session opens Viewing activity and clicks official **Download all**, then imports the CSV. You can still upload a CSV or keep `NetflixViewingHistory.csv` in the repo as a fallback. Prime Video: upload the privacy ZIP, or click **Load PrimeVideoViewingHistory.csv** if that file is in `data/uploads/`.
2. Select Netflix, Prime, Disney+, and/or HBO Max, then **Refresh selected**. Each service is pulled separately from TMDB / JustWatch. If `OMDB_API_KEY` is set, click **Fetch Metascores** to score the movies you already have. That pass does not re-download catalogs.
3. Confirm leftovers on Review matches.
4. Browse or export the Unseen list. Filter by service if you want.

A matched Netflix title is treated as seen on every service.

Watch availability is provided by JustWatch via TMDB. The catalogs are approximations of each US service, not their private inventories.

## Tests

```bash
npm test
```
