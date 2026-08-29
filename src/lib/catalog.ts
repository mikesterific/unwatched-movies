import { getDb, type CatalogMovieRow } from "@/lib/db";
import { rematchAgainstCatalog } from "@/lib/history";
import { getServiceBySlug, resolveServices } from "@/lib/services";
import { fetchUsCatalog, type TmdbMovie } from "@/lib/tmdb";

export type ServiceRefreshResult = {
  slug: string;
  name: string;
  movieCount: number;
  refreshedAt: string;
  rematched: { reviewed: number; matched: number };
};

export function replaceServiceCatalog(
  slug: string,
  movies: TmdbMovie[],
): { slug: string; name: string; movieCount: number; refreshedAt: string } {
  const service = getServiceBySlug(slug);
  if (!service) {
    throw new Error(`Unknown service "${slug}". Use netflix, prime, disney, or max.`);
  }

  const db = getDb();
  const refreshedAt = new Date().toISOString();

  const upsertMovie = db.prepare(`
    INSERT INTO catalog_movies (
      tmdb_id, title, original_title, release_year, poster_path,
      genre_ids, popularity, vote_average, overview
    ) VALUES (
      @tmdbId, @title, @originalTitle, @releaseYear, @posterPath,
      @genreIds, @popularity, @voteAverage, @overview
    )
    ON CONFLICT(tmdb_id) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      release_year = excluded.release_year,
      poster_path = excluded.poster_path,
      genre_ids = excluded.genre_ids,
      popularity = excluded.popularity,
      vote_average = excluded.vote_average,
      overview = excluded.overview
  `);

  const insertAvailability = db.prepare(`
    INSERT INTO catalog_availability (tmdb_id, provider_id)
    VALUES (?, ?)
  `);

  const write = db.transaction((rows: TmdbMovie[]) => {
    db.prepare("DELETE FROM catalog_availability WHERE provider_id = ?").run(service.providerId);
    for (const movie of rows) {
      upsertMovie.run({
        tmdbId: movie.tmdbId,
        title: movie.title,
        originalTitle: movie.originalTitle,
        releaseYear: movie.releaseYear,
        posterPath: movie.posterPath,
        genreIds: `,${movie.genreIds.join(",")},`,
        popularity: movie.popularity,
        voteAverage: movie.voteAverage,
        overview: movie.overview,
      });
      insertAvailability.run(movie.tmdbId, service.providerId);
    }
    db.prepare(
      `
      DELETE FROM catalog_movies
      WHERE tmdb_id NOT IN (SELECT tmdb_id FROM catalog_availability)
    `,
    ).run();
    db.prepare(
      `
      UPDATE catalog_services
      SET refreshed_at = ?, movie_count = ?
      WHERE provider_id = ?
    `,
    ).run(refreshedAt, rows.length, service.providerId);
  });

  write(movies);
  return {
    slug: service.slug,
    name: service.name,
    movieCount: movies.length,
    refreshedAt,
  };
}

export function replaceCatalog(movies: TmdbMovie[]): {
  slug: string;
  name: string;
  movieCount: number;
  refreshedAt: string;
} {
  return replaceServiceCatalog("netflix", movies);
}

export async function refreshCatalog(slugs?: string[]): Promise<{
  services: ServiceRefreshResult[];
}> {
  const selected = resolveServices(slugs);
  const services: ServiceRefreshResult[] = [];

  for (const service of selected) {
    const movies = await fetchUsCatalog(service.providerId);
    const replaced = replaceServiceCatalog(service.slug, movies);
    const rematched = rematchAgainstCatalog();
    services.push({ ...replaced, rematched });
  }

  return { services };
}

export function listCatalogMovies(): CatalogMovieRow[] {
  return getDb()
    .prepare("SELECT * FROM catalog_movies")
    .all() as CatalogMovieRow[];
}

export function listAvailability(providerId?: number): Array<{ tmdb_id: number; provider_id: number }> {
  if (providerId == null) {
    return getDb()
      .prepare("SELECT tmdb_id, provider_id FROM catalog_availability")
      .all() as Array<{ tmdb_id: number; provider_id: number }>;
  }
  return getDb()
    .prepare("SELECT tmdb_id, provider_id FROM catalog_availability WHERE provider_id = ?")
    .all(providerId) as Array<{ tmdb_id: number; provider_id: number }>;
}
