import { getDb } from "@/lib/db";

const OMDB_URL = "https://www.omdbapi.com/";
const ENRICH_CONCURRENCY = 12;

export type OmdbRating = {
  imdbId: string | null;
  metascore: number | null;
  imdbVotes: number | null;
};

type CatalogRatingRow = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number | null;
};

export function getOmdbApiKey(): string | null {
  const fromEnv = process.env.OMDB_API_KEY?.trim();
  return fromEnv ? fromEnv : null;
}

function parseCount(value: unknown): number | null {
  if (value == null || value === "N/A") {
    return null;
  }
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOmdbResponse(data: unknown): OmdbRating | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record.Response === "False") {
    return null;
  }

  const imdbId =
    typeof record.imdbID === "string" && record.imdbID.startsWith("tt")
      ? record.imdbID
      : null;

  return {
    imdbId,
    metascore: parseCount(record.Metascore),
    imdbVotes: parseCount(record.imdbVotes),
  };
}

export async function fetchOmdbRating(input: {
  title: string;
  year: number | null;
}): Promise<OmdbRating | null> {
  const apiKey = getOmdbApiKey();
  if (!apiKey) {
    return null;
  }

  const url = new URL(OMDB_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("t", input.title);
  url.searchParams.set("type", "movie");
  if (input.year) {
    url.searchParams.set("y", String(input.year));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OMDb lookup failed: ${response.status} ${response.statusText}`);
  }
  return parseOmdbResponse(await response.json());
}

async function lookupMovie(row: CatalogRatingRow): Promise<OmdbRating | null> {
  const byTitle = await fetchOmdbRating({ title: row.title, year: row.release_year });
  if (byTitle) {
    return byTitle;
  }
  if (row.original_title && row.original_title !== row.title) {
    return fetchOmdbRating({ title: row.original_title, year: row.release_year });
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("401") || message.includes("403");
}

export async function enrichCatalogRatings(tmdbIds?: number[]): Promise<{
  fetched: number;
  rated: number;
}> {
  if (!getOmdbApiKey()) {
    return { fetched: 0, rated: 0 };
  }
  if (tmdbIds && tmdbIds.length === 0) {
    return { fetched: 0, rated: 0 };
  }

  const db = getDb();
  const pending = db
    .prepare(
      `
      SELECT tmdb_id, title, original_title, release_year
      FROM catalog_movies
      WHERE omdb_fetched_at IS NULL
    `,
    )
    .all() as CatalogRatingRow[];

  const allow = tmdbIds ? new Set(tmdbIds) : null;
  const rows = allow ? pending.filter((row) => allow.has(row.tmdb_id)) : pending;
  if (rows.length === 0) {
    return { fetched: 0, rated: 0 };
  }

  const update = db.prepare(`
    UPDATE catalog_movies
    SET imdb_id = @imdbId,
        metascore = @metascore,
        imdb_votes = @imdbVotes,
        omdb_fetched_at = @fetchedAt
    WHERE tmdb_id = @tmdbId
  `);

  let fetched = 0;
  let rated = 0;
  await mapPool(rows, ENRICH_CONCURRENCY, async (row) => {
    try {
      const rating = await lookupMovie(row);
      update.run({
        tmdbId: row.tmdb_id,
        imdbId: rating?.imdbId ?? null,
        metascore: rating?.metascore ?? null,
        imdbVotes: rating?.imdbVotes ?? null,
        fetchedAt: new Date().toISOString(),
      });
      fetched += 1;
      if (rating?.metascore != null) {
        rated += 1;
      }
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
    }
  });

  return { fetched, rated };
}
