import { allGenreOptions, genreNames } from "@/lib/genres";
import {
  getDb,
  getRefreshedProviderIds,
  type CatalogMovieRow,
} from "@/lib/db";
import { CATALOG_SERVICES, getServiceBySlug, watchUrlForTitle } from "@/lib/services";
import { posterUrl } from "@/lib/tmdb";
import type { ServiceLabel, UnseenMovie, UnseenPage, UnseenSort } from "@/lib/types";

export const MIN_RATING_VOTES = 100;

const TRUSTED_RATING_SQL = `CASE
  WHEN c.metascore IS NOT NULL AND IFNULL(c.imdb_votes, 0) >= ${MIN_RATING_VOTES}
  THEN c.metascore
END`;

export type UnseenQuery = {
  q?: string;
  genre?: number;
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
  providers?: string[];
  sort?: UnseenSort;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const SORT_COLUMNS: Record<UnseenSort, string> = {
  popularity: "c.popularity",
  year: "c.release_year",
  rating: TRUSTED_RATING_SQL,
  title: "c.title COLLATE NOCASE",
};

type UnseenRow = CatalogMovieRow & {
  service_slugs: string | null;
};

export function trustedRating(
  metascore: number | null | undefined,
  imdbVotes: number | null | undefined,
): number | null {
  if (metascore == null || imdbVotes == null || imdbVotes < MIN_RATING_VOTES) {
    return null;
  }
  return metascore;
}

function parseGenreIds(raw: string): number[] {
  if (raw.startsWith("[")) {
    return JSON.parse(raw) as number[];
  }
  return raw
    .split(",")
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

function labelsForSlugs(slugs: string[], title: string): ServiceLabel[] {
  return slugs
    .map((slug) => getServiceBySlug(slug))
    .filter((service): service is NonNullable<typeof service> => Boolean(service))
    .map((service) => ({
      slug: service.slug,
      name: service.name,
      watchUrl: watchUrlForTitle(service.slug, title) ?? undefined,
    }));
}

function toUnseenMovie(row: UnseenRow): UnseenMovie {
  const genreIds = parseGenreIds(row.genre_ids);
  const slugs = (row.service_slugs ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  return {
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.release_year,
    posterUrl: posterUrl(row.poster_path),
    genres: genreNames(genreIds),
    genreIds,
    popularity: row.popularity,
    rating: trustedRating(row.metascore, row.imdb_votes),
    overview: row.overview,
    tmdbUrl: `https://www.themoviedb.org/movie/${row.tmdb_id}`,
    services: labelsForSlugs(slugs, row.title),
  };
}

function providerIdsForQuery(slugs?: string[]): number[] {
  if (slugs?.length) {
    return slugs.map((slug) => {
      const service = getServiceBySlug(slug);
      if (!service) {
        throw new Error(`Unknown service "${slug}". Use netflix, prime, disney, or max.`);
      }
      return service.providerId;
    });
  }
  return getRefreshedProviderIds();
}

function availableServiceLabels(): ServiceLabel[] {
  return CATALOG_SERVICES.map((service) => ({ slug: service.slug, name: service.name }));
}

export function queryUnseen(input: UnseenQuery = {}): UnseenPage {
  const pageSize = Math.min(Math.max(input.pageSize ?? 24, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const sort = input.sort ?? "popularity";
  const order = input.order ?? "desc";
  const sortSql = SORT_COLUMNS[sort] ?? SORT_COLUMNS.popularity;
  const direction = order === "asc" ? "ASC" : "DESC";
  const providerIds = providerIdsForQuery(input.providers);

  if (providerIds.length === 0) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      genres: allGenreOptions(),
      services: availableServiceLabels(),
    };
  }

  const where: string[] = ["w.id IS NULL"];
  const params: Record<string, string | number> = {};

  const providerPlaceholders = providerIds.map((_, index) => {
    params[`p${index}`] = providerIds[index];
    return `@p${index}`;
  });
  where.push(`filter_a.provider_id IN (${providerPlaceholders.join(", ")})`);

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
  if (typeof input.ratingMin === "number" && Number.isFinite(input.ratingMin)) {
    where.push(
      `(${TRUSTED_RATING_SQL}) IS NOT NULL AND (${TRUSTED_RATING_SQL}) >= @ratingMin`,
    );
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
        SELECT COUNT(*) AS count FROM (
          SELECT c.tmdb_id
          FROM catalog_movies c
          JOIN catalog_availability filter_a ON filter_a.tmdb_id = c.tmdb_id
          LEFT JOIN watched_titles w
            ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
          WHERE ${whereSql}
          GROUP BY c.tmdb_id
        )
      `,
      )
      .get(params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `
      SELECT
        c.*,
        GROUP_CONCAT(DISTINCT s.slug) AS service_slugs
      FROM catalog_movies c
      JOIN catalog_availability filter_a ON filter_a.tmdb_id = c.tmdb_id
      JOIN catalog_availability a ON a.tmdb_id = c.tmdb_id
      JOIN catalog_services s ON s.provider_id = a.provider_id
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE ${whereSql}
      GROUP BY c.tmdb_id
      ORDER BY ${sort === "rating" ? `(${TRUSTED_RATING_SQL}) IS NULL, ` : ""}${sortSql} ${direction}, c.title COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all({
      ...params,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }) as UnseenRow[];

  return JSON.parse(
    JSON.stringify({
      items: rows.map(toUnseenMovie),
      total,
      page,
      pageSize,
      genres: allGenreOptions(),
      services: availableServiceLabels(),
    }),
  ) as UnseenPage;
}

export function exportUnseenCsv(providers?: string[]): string {
  const providerIds = providerIdsForQuery(providers);
  if (providerIds.length === 0) {
    return "Title,Year,Genres,Rating,Popularity,Services,TMDB URL,Watch URLs\n";
  }

  const params: Record<string, number> = {};
  const placeholders = providerIds.map((id, index) => {
    params[`p${index}`] = id;
    return `@p${index}`;
  });

  const rows = getDb()
    .prepare(
      `
      SELECT
        c.*,
        GROUP_CONCAT(DISTINCT s.slug) AS service_slugs
      FROM catalog_movies c
      JOIN catalog_availability filter_a ON filter_a.tmdb_id = c.tmdb_id
      JOIN catalog_availability a ON a.tmdb_id = c.tmdb_id
      JOIN catalog_services s ON s.provider_id = a.provider_id
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE w.id IS NULL
        AND filter_a.provider_id IN (${placeholders.join(", ")})
      GROUP BY c.tmdb_id
      ORDER BY c.title COLLATE NOCASE
    `,
    )
    .all(params) as UnseenRow[];

  const header = [
    "Title",
    "Year",
    "Genres",
    "Rating",
    "Popularity",
    "Services",
    "TMDB URL",
    "Watch URLs",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) => {
      const movie = toUnseenMovie(row);
      return [
        csvEscape(movie.title),
        movie.year ?? "",
        csvEscape(movie.genres.join("; ")),
        movie.rating ?? "",
        movie.popularity.toFixed(1),
        csvEscape(movie.services.map((service) => service.name).join("; ")),
        movie.tmdbUrl,
        csvEscape(
          movie.services
            .map((service) => (service.watchUrl ? `${service.name}: ${service.watchUrl}` : null))
            .filter((value): value is string => Boolean(value))
            .join("; "),
        ),
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
