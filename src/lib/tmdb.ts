import { AUTH_KEY_HELP, getStoredTmdbApiKey } from "@/lib/auth";
import type { MatchCandidate } from "@/lib/matching";
import { NETFLIX_PROVIDER_ID } from "@/lib/services";

const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";
export { NETFLIX_PROVIDER_ID };
export const WATCH_REGION = "US";
const MAX_DISCOVER_PAGES = 500;

export type TmdbMovie = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterPath: string | null;
  genreIds: number[];
  popularity: number;
  voteAverage: number;
  overview: string;
};

type TmdbMovieResult = {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  popularity?: number;
  vote_average?: number;
  overview?: string;
};

type DiscoverResponse = {
  page: number;
  total_pages: number;
  results: TmdbMovieResult[];
};

export function getTmdbApiKey(): string | null {
  return getStoredTmdbApiKey();
}

function authHeaders(apiKey: string): HeadersInit {
  if (apiKey.startsWith("eyJ")) {
    return { Authorization: `Bearer ${apiKey}`, accept: "application/json" };
  }
  return { accept: "application/json" };
}

function withKey(url: URL, apiKey: string): URL {
  if (!apiKey.startsWith("eyJ")) {
    url.searchParams.set("api_key", apiKey);
  }
  return url;
}

function yearFromDate(releaseDate: string | undefined): number | null {
  if (!releaseDate || releaseDate.length < 4) {
    return null;
  }
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function toMovie(result: TmdbMovieResult): TmdbMovie {
  return {
    tmdbId: result.id,
    title: result.title ?? result.original_title ?? "Untitled",
    originalTitle: result.original_title ?? result.title ?? "Untitled",
    releaseYear: yearFromDate(result.release_date),
    posterPath: result.poster_path ?? null,
    genreIds: result.genre_ids ?? [],
    popularity: result.popularity ?? 0,
    voteAverage: result.vote_average ?? 0,
    overview: result.overview ?? "",
  };
}

function toCandidate(result: TmdbMovieResult): MatchCandidate {
  const movie = toMovie(result);
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    originalTitle: movie.originalTitle,
    releaseYear: movie.releaseYear,
    posterPath: movie.posterPath,
    popularity: movie.popularity,
  };
}

async function tmdbGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new Error(`TMDB_API_KEY is not set. ${AUTH_KEY_HELP}`);
  }

  const url = withKey(new URL(`${TMDB_BASE}${path}`), apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers: authHeaders(apiKey) });
  if (!response.ok) {
    throw new Error(`TMDB ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
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

export async function searchMovies(query: string): Promise<MatchCandidate[]> {
  const data = await tmdbGet<DiscoverResponse>("/search/movie", {
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  return (data.results ?? []).slice(0, 8).map(toCandidate);
}

function discoverParams(providerId: number, page: string): Record<string, string> {
  return {
    with_watch_providers: String(providerId),
    watch_region: WATCH_REGION,
    with_watch_monetization_types: "flatrate",
    include_adult: "false",
    language: "en-US",
    sort_by: "popularity.desc",
    page,
  };
}

export async function fetchUsCatalog(
  providerId: number,
  onProgress?: (page: number, totalPages: number) => void,
): Promise<TmdbMovie[]> {
  const first = await tmdbGet<DiscoverResponse>("/discover/movie", discoverParams(providerId, "1"));

  const totalPages = Math.min(first.total_pages ?? 1, MAX_DISCOVER_PAGES);
  onProgress?.(1, totalPages);

  const movies = new Map<number, TmdbMovie>();
  for (const result of first.results ?? []) {
    movies.set(result.id, toMovie(result));
  }

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  await mapPool(remainingPages, 4, async (page) => {
    const data = await tmdbGet<DiscoverResponse>(
      "/discover/movie",
      discoverParams(providerId, String(page)),
    );
    for (const result of data.results ?? []) {
      movies.set(result.id, toMovie(result));
    }
    onProgress?.(page, totalPages);
  });

  return [...movies.values()];
}

export async function fetchUsNetflixCatalog(
  onProgress?: (page: number, totalPages: number) => void,
): Promise<TmdbMovie[]> {
  return fetchUsCatalog(NETFLIX_PROVIDER_ID, onProgress);
}

export function posterUrl(posterPath: string | null): string | null {
  return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;
}
