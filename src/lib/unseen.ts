import { allGenreOptions, genreNames } from "@/lib/genres";
import { getDb, type CatalogMovieRow } from "@/lib/db";
import { posterUrl } from "@/lib/tmdb";
import type { UnseenMovie, UnseenPage, UnseenSort } from "@/lib/types";

export type UnseenQuery = {
  q?: string;
  genre?: number;
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
  sort?: UnseenSort;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const SORT_COLUMNS: Record<UnseenSort, string> = {
  popularity: "c.popularity",
  year: "c.release_year",
  rating: "c.vote_average",
  title: "c.title COLLATE NOCASE",
};

function parseGenreIds(raw: string): number[] {
  if (raw.startsWith("[")) {
    return JSON.parse(raw) as number[];
  }
  return raw
    .split(",")
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

function toUnseenMovie(row: CatalogMovieRow): UnseenMovie {
  const genreIds = parseGenreIds(row.genre_ids);
  return {
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.release_year,
    posterUrl: posterUrl(row.poster_path),
    genres: genreNames(genreIds),
    genreIds,
    popularity: row.popularity,
    voteAverage: row.vote_average,
    overview: row.overview,
    tmdbUrl: `https://www.themoviedb.org/movie/${row.tmdb_id}`,
  };
}

export function queryUnseen(input: UnseenQuery = {}): UnseenPage {
  const pageSize = Math.min(Math.max(input.pageSize ?? 24, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const sort = input.sort ?? "popularity";
  const order = input.order ?? "desc";
  const sortSql = SORT_COLUMNS[sort] ?? SORT_COLUMNS.popularity;
  const direction = order === "asc" ? "ASC" : "DESC";

  const where: string[] = ["w.id IS NULL"];
  const params: Record<string, string | number> = {};

  if (input.q?.trim()) {
    where.push("(c.title LIKE @q OR c.original_title LIKE @q)");
    params.q = `%${input.q.trim()}%`;
  }
  if (input.yearMin) {
    where.push("c.release_year >= @yearMin");
    params.yearMin = input.yearMin;
  }
  if (input.yearMax) {
    where.push("c.release_year <= @yearMax");
    params.yearMax = input.yearMax;
  }
  if (input.ratingMin) {
    where.push("c.vote_average >= @ratingMin");
    params.ratingMin = input.ratingMin;
  }
  if (input.genre) {
    where.push("c.genre_ids LIKE @genre");
    params.genre = `%,${input.genre},%`;
  }

  const whereSql = where.join(" AND ");
  const db = getDb();
  const total = (
    db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM catalog_movies c
        LEFT JOIN watched_titles w
          ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
        WHERE ${whereSql}
      `,
      )
      .get(params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `
      SELECT c.*
      FROM catalog_movies c
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE ${whereSql}
      ORDER BY ${sortSql} ${direction}, c.title COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all({
      ...params,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }) as CatalogMovieRow[];

  return JSON.parse(
    JSON.stringify({
      items: rows.map(toUnseenMovie),
      total,
      page,
      pageSize,
      genres: allGenreOptions(),
    }),
  ) as UnseenPage;
}

export function exportUnseenCsv(): string {
  const all = getDb()
    .prepare(
      `
      SELECT c.*
      FROM catalog_movies c
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE w.id IS NULL
      ORDER BY c.title COLLATE NOCASE
    `,
    )
    .all() as CatalogMovieRow[];

  const header = ["Title", "Year", "Genres", "Rating", "Popularity", "TMDB URL"];
  const lines = [
    header.join(","),
    ...all.map((row) => {
      const movie = toUnseenMovie(row);
      return [
        csvEscape(movie.title),
        movie.year ?? "",
        csvEscape(movie.genres.join("; ")),
        movie.voteAverage.toFixed(1),
        movie.popularity.toFixed(1),
        movie.tmdbUrl,
      ].join(",");
    }),
  ];

  return `${lines.join("\n")}\n`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
