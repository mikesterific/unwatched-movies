# Unseen Movies

Local web app that subtracts your official watch history from cached US catalogs
for Netflix, Prime Video, Disney+, and HBO Max.

Catalogs come from [TMDB](https://www.themoviedb.org/) (availability via
JustWatch). History comes from Netflix’s official **Download all** CSV and
Amazon’s official Prime Video privacy ZIP. The app does not scrape streaming
sites or hidden viewing-activity APIs.

A matched title is treated as seen on every service.

## What you need

- [Node.js](https://nodejs.org/) 22.5 or newer (`node:sqlite`)
- A free [TMDB API key](https://www.themoviedb.org/settings/api) for live catalogs
- Optional: [OMDb](https://www.omdbapi.com/) key for Metascores
- Optional: [Google Chrome](https://www.google.com/chrome/) if you want the app
  to click Netflix **Download all** for you

## 1. Install and run

```bash
git clone https://github.com/mikesterific/unwatched-movies.git
cd unwatched-movies
npm install
npx playwright install chromium
cp auth.example.json auth.json
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see **Setup**.

**Load sample catalog** on that page lets you click through the UI without a
TMDB key or any watch history.

## 2. Add your TMDB key

1. Create a free key at [TMDB API settings](https://www.themoviedb.org/settings/api).
   A v3 key or a v4 read-access token both work.
2. On Setup, paste it into **TMDB API key** and click **Save to auth.json**.
   Or put it in `auth.json` as `tmdbApiKey`. That file is gitignored.

Optional: put `OMDB_API_KEY` in `.env`. After catalogs are cached, click
**Fetch Metascores**. Titles with fewer than 100 IMDb votes stay unrated.

## 3. Import Netflix watch history

Use **one** of the two options. You want the Viewing activity CSV (usually
named `NetflixViewingHistory.csv`), not the slower “download a copy of your
information” account archive.

Netflix’s own help: [Viewing history and device activity](https://help.netflix.com/en/node/101917).

### Option A — let the app download it

1. In a terminal, from this project folder, run:

   ```bash
   npm run auth:netflix
   ```

2. Finish login and 2FA in the Chrome window that opens. Prefer email and
   password. **Sign in with Google** often fails in Chromium.
3. Pick the Netflix **profile** you want tracked.
4. On Setup, click **Refresh watch history**. The saved session opens
   [Viewing activity](https://www.netflix.com/WiViewingActivity), clicks official
   **Download all**, and imports the CSV.

The session is saved to gitignored `.auth/netflix.json`. The CLI never takes
your password.

If you already have Chrome open and want to attach to it:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.chrome-cdp-netflix"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$PWD/.chrome-cdp-netflix"

# Windows (Command Prompt)
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%CD%\.chrome-cdp-netflix"
```

Then:

```bash
npm run auth:netflix -- --existing
```

### Option B — download the CSV yourself

1. Sign in to [Netflix](https://www.netflix.com/) in a regular browser.
2. Open [Viewing activity](https://www.netflix.com/WiViewingActivity).
   Or: Account → Profiles → your profile → **Viewing activity**.
3. Scroll to the bottom of the page and click **Download all**.
4. On Setup, use **Or upload a Netflix CSV or Prime Video ZIP** and choose that
   file. Or save it as `NetflixViewingHistory.csv` in the project folder and
   click **Load NetflixViewingHistory.csv**.

## 4. Import Prime Video watch history

Amazon does not offer an instant watch-history CSV. Request an official privacy
export, then upload it here. This can take a few days (Amazon may say up to 30).

1. Sign in to Amazon and open
   [Request your data](https://www.amazon.com/hz/privacy-central/data-requests/preview.html).
   Or: Account & Lists → Your Account → **Request your data**.
   If you shop on another Amazon store, use that store’s Privacy Central.
2. Request **Prime Video** data. You do not need the entire Amazon archive.
3. Confirm the email Amazon sends.
4. When Amazon emails that the file is ready, download the ZIP.
5. On Setup, upload that ZIP. The app reads
   `Your Prime Video Viewing Activity/Viewing History.csv` inside it.

You can also unzip it yourself and upload `Viewing History.csv`, or drop
`Prime Video.zip` / `PrimeVideoViewingHistory.csv` in `data/uploads/` and click
the load button on Setup.

Use **Viewing History.csv** only. Skip these files in the same ZIP:

- `Watch Events.csv` — titles without enough season/episode data to filter TV
- `Purchases and Rentals.csv` — ownership, not watches
- `Promotional Trailers Viewed.csv` — trailers only

The parser keeps full/feature movies, drops trailers, ads, TV-shaped titles,
and watches under two minutes, then merges into the same seen list without
replacing existing Netflix matches.

## 5. Refresh catalogs and browse Unseen

1. On Setup, select Netflix, Prime Video, Disney+, and/or HBO Max.
   Disney+ and HBO Max are catalogs only; they have no watch-history export.
2. Click **Refresh selected**. Each service is pulled separately from TMDB /
   JustWatch.
3. Optional: click **Fetch Metascores** if `OMDB_API_KEY` is set.
4. Open **Review matches** and confirm leftovers.
5. Open **Unseen** to browse or export. Filter by service if you want.
   **All titles** includes movies you already marked watched.

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

Unseen Movies is an independent project. It is not affiliated with, endorsed by, or
sponsored by Netflix, Amazon, Disney, Warner Bros. Discovery, TMDB, JustWatch,
or OMDb. Those names are trademarks of their owners.

You are responsible for following each service’s terms when you sign in or
export your own data. Catalog use must follow
[TMDB’s terms](https://www.themoviedb.org/documentation/api/terms-of-use) and
attribution rules.

## License

[MIT](LICENSE)
