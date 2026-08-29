# Unseen

Local web app that subtracts your official watch history from cached US catalogs
for Netflix, Prime Video, Disney+, and HBO Max.

Catalogs come from [TMDB](https://www.themoviedb.org/) (availability via
JustWatch). History comes from Netflix’s official **Download all** CSV and
Amazon’s official Prime Video privacy ZIP. The app does not scrape streaming
sites or hidden viewing-activity APIs.

A matched title is treated as seen on every service.

## Requirements

- [Node.js](https://nodejs.org/) 22.5 or newer (`node:sqlite`)
- A free [TMDB API key](https://www.themoviedb.org/settings/api) for live catalogs
- Optional: [OMDb](https://www.omdbapi.com/) key for Metascores
- Optional: headed Chrome for one-time Netflix sign-in

## Setup

```bash
git clone https://github.com/mikesterific/unwatched-movies.git
cd unwatched-movies
npm install
npx playwright install chromium
cp auth.example.json auth.json
cp .env.example .env
```

Put your TMDB v3 key or v4 read-access token in `auth.json` as `tmdbApiKey`,
or paste it on the Setup screen. `auth.json` is gitignored.

Optional: set `OMDB_API_KEY` in `.env`. After catalogs are cached, click
**Fetch Metascores** on Setup. Titles with fewer than 100 IMDb votes stay
unrated.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Load sample catalog**
lets you try the UI without TMDB.

## Watch history

### Netflix

Sign in once in headed Chrome. You finish login and 2FA; the CLI never takes a
password. The session is saved to gitignored `.auth/netflix.json`.

```bash
npm run auth:netflix
```

Pick the profile you want tracked. Then on Setup click **Refresh watch
history**. The saved session opens Viewing activity, clicks official
**Download all**, and imports the CSV.

You can also upload a CSV, or keep a local `NetflixViewingHistory.csv` in the
project folder (gitignored) and load it from Setup.

To attach to Chrome you start yourself:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.chrome-cdp-netflix"
npm run auth:netflix -- --existing
```

### Prime Video

Request your data from Amazon Privacy Central and upload the privacy ZIP (or
the `Viewing History.csv` inside it). You can also drop
`PrimeVideoViewingHistory.csv` or `Prime Video.zip` in `data/uploads/` and
click the load button on Setup.

The parser keeps full/feature movies, drops trailers, ads, TV-shaped titles,
and watches under two minutes, then merges into the same seen list without
replacing existing Netflix matches.

## Catalogs and Unseen

1. Select Netflix, Prime Video, Disney+, and/or HBO Max, then **Refresh
   selected**. Each service is pulled separately from TMDB / JustWatch.
2. Confirm leftovers on **Review matches**.
3. Browse or export the Unseen list. Filter by service if you want. **All
   titles** includes movies you already marked watched.

Watch availability is an approximation of each US service, not a private
inventory. Attribution: JustWatch via TMDB.

## Development

```bash
npm test
npm run lint
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

This app is meant to run on your machine. Do not commit:

- `auth.json`, `.env`, `.auth/`
- `NetflixViewingHistory.csv`, Prime privacy ZIPs
- `data/*.sqlite*`

The `fixtures/` folder uses fake titles only.

## Legal

Unseen is an independent project. It is not affiliated with, endorsed by, or
sponsored by Netflix, Amazon, Disney, Warner Bros. Discovery, TMDB, JustWatch,
or OMDb. Those names are trademarks of their owners.

You are responsible for following each service’s terms when you sign in or
export your own data. Catalog use must follow
[TMDB’s terms](https://www.themoviedb.org/documentation/api/terms-of-use) and
attribution rules.

## License

[MIT](LICENSE)
