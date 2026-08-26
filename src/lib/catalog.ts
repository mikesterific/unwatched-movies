import { getDb, type CatalogMovieRow } from "@/lib/db";
import { fetchUsNetflixCatalog, type TmdbMovie } from "@/lib/tmdb";

export function replaceCatalog(movies: TmdbMovie[]): { movieCount: number; refreshedAt: string } {
  const db = getDb();
  const refreshedAt = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO catalog_movies (
      tmdb_id, title, original_title, release_year, poster_path,
      genre_ids, popularity, vote_average, overview
    ) VALUES (
      @tmdbId, @title, @originalTitle, @releaseYear, @posterPath,
      @genreIds, @popularity, @voteAverage, @overview
    )
  `);

  const write = db.transaction((rows: TmdbMovie[]) => {
    db.prepare("DELETE FROM catalog_movies").run();
    for (const movie of rows) {
      insert.run({
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
    }
    db.prepare(
      `
      INSERT INTO catalog_meta (id, refreshed_at, movie_count)
      VALUES (1, @refreshedAt, @movieCount)
      ON CONFLICT(id) DO UPDATE SET
        refreshed_at = excluded.refreshed_at,
        movie_count = excluded.movie_count
    `,
    ).run({ refreshedAt, movieCount: rows.length });
  });

  write(movies);
  return { movieCount: movies.length, refreshedAt };
}

export async function refreshCatalog() {
  const movies = await fetchUsNetflixCatalog();
  return replaceCatalog(movies);
}

export function listCatalogMovies(): CatalogMovieRow[] {
  return getDb()
    .prepare("SELECT * FROM catalog_movies")
    .all() as CatalogMovieRow[];
}
