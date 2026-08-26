# Unseen on Netflix

Local web app that subtracts your official Netflix viewing-activity CSV from a cached US Netflix movie catalog (TMDB + JustWatch).

It does not log into Netflix or scrape internal endpoints.

## Setup

1. Copy `auth.example.json` to `auth.json`, or paste a key on the Setup screen.
2. Create a free [TMDB API key](https://www.themoviedb.org/settings/api) and put it in `tmdbApiKey`. A v4 read-access token also works. `auth.json` is gitignored.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Get your watch history

1. On a computer, open Netflix and go to Account.
2. Choose your profile, then Viewing activity.
3. Scroll to the bottom and click **Download all**.
4. Save that file in the project root as `NetflixViewingHistory.csv`, or upload it on Setup.

The app loads that project CSV automatically when you start it somewhere else. You only need a new export when you want newer watches. The slower Privacy export (`ViewingActivity.csv`) also works.

## Use

1. Refresh the US movie catalog.
2. Upload the CSV. Exact TMDB title matches are marked watched automatically.
3. Confirm leftovers on Review matches.
4. Browse or export the Unseen list.

Watch availability is provided by JustWatch via TMDB. The catalog is an approximation of Netflix US, not Netflix's private inventory.

## Tests

```bash
npm test
```
