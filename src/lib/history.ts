import { parseNetflixCsv, type ParsedMovie } from "@/lib/csv";
import {
  getDb,
  getHistoryMeta,
  type CatalogMovieRow,
  type WatchedTitleRow,
} from "@/lib/db";
import { pickAutoMatch, type MatchCandidate } from "@/lib/matching";
import { normalizeTitle } from "@/lib/normalize";
import {
  extractPrimeViewingHistory,
  isPrimeViewingHistoryCsv,
  parsePrimeCsv,
} from "@/lib/prime-csv";
import { getTmdbApiKey, searchMovies } from "@/lib/tmdb";

export type UploadSummary = {
  movieRowCount: number;
  droppedRowCount: number;
  matched: number;
  review: number;
  ignored: number;
  searched: number;
};

function findCatalogMatches(title: string): MatchCandidate[] {
  const normalized = normalizeTitle(title);
  const rows = getDb()
    .prepare("SELECT tmdb_id, title, original_title, release_year, poster_path, popularity FROM catalog_movies")
    .all() as Array<{
    tmdb_id: number;
    title: string;
    original_title: string;
    release_year: number | null;
    poster_path: string | null;
    popularity: number;
  }>;

  return rows
    .filter((row) => {
      return (
        normalizeTitle(row.title) === normalized ||
        normalizeTitle(row.original_title) === normalized
      );
    })
    .map((row) => ({
      tmdbId: row.tmdb_id,
      title: row.title,
      originalTitle: row.original_title,
      releaseYear: row.release_year,
      posterPath: row.poster_path,
      popularity: row.popularity,
    }));
}

function parseCandidates(json: string | null): MatchCandidate[] {
  if (!json) {
    return [];
  }
  try {
    return JSON.parse(json) as MatchCandidate[];
  } catch {
    return [];
  }
}

async function resolveTitle(
  movie: ParsedMovie,
  existing: WatchedTitleRow | undefined,
): Promise<{
  tmdbId: number | null;
  status: WatchedTitleRow["status"];
  candidates: MatchCandidate[];
  searched: boolean;
}> {
  if (existing?.status === "matched" || existing?.status === "ignored") {
    return {
      tmdbId: existing.tmdb_id,
      status: existing.status,
      candidates: parseCandidates(existing.candidates_json),
      searched: false,
    };
  }

  const existingCandidates = parseCandidates(existing?.candidates_json ?? null);
  if (existing?.status === "review" && existingCandidates.length > 0) {
    return {
      tmdbId: existing.tmdb_id,
      status: "review",
      candidates: existingCandidates,
      searched: false,
    };
  }

  const catalogMatches = findCatalogMatches(movie.rawTitle);
  const catalogAuto = pickAutoMatch(movie.rawTitle, catalogMatches);
  if (catalogAuto) {
    return {
      tmdbId: catalogAuto.tmdbId,
      status: "matched",
      candidates: catalogMatches,
      searched: false,
    };
  }

  if (!getTmdbApiKey()) {
    return {
      tmdbId: null,
      status: "review",
      candidates: catalogMatches,
      searched: false,
    };
  }

  const candidates = await searchMovies(movie.rawTitle);
  const auto = pickAutoMatch(movie.rawTitle, candidates);
  if (auto) {
    return {
      tmdbId: auto.tmdbId,
      status: "matched",
      candidates,
      searched: true,
    };
  }

  return {
    tmdbId: null,
    status: "review",
    candidates,
    searched: true,
  };
}

function laterWatchedAt(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  if (!left) {
    return right ?? null;
  }
  if (!right) {
    return left;
  }
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) && Number.isNaN(rightMs)) {
    return left > right ? left : right;
  }
  if (Number.isNaN(leftMs)) {
    return right;
  }
  if (Number.isNaN(rightMs)) {
    return left;
  }
  return leftMs >= rightMs ? left : right;
}

function mergeSourceFilename(previous: string | null | undefined, next: string): string {
  const parts = (previous ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(next)) {
    parts.push(next);
  }
  return parts.join(", ");
}

function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function importHistoryFile(input: {
  filename: string;
  bytes: Uint8Array;
}): Promise<UploadSummary> {
  const name = input.filename.toLowerCase();
  const text =
    name.endsWith(".zip") || isZipBytes(input.bytes)
      ? await extractPrimeViewingHistory(input.bytes)
      : new TextDecoder("utf-8").decode(input.bytes);
  return importViewingCsv(text, input.filename);
}

export async function importViewingCsv(
  text: string,
  sourceFilename: string,
): Promise<UploadSummary> {
  const parsed = isPrimeViewingHistoryCsv(text)
    ? parsePrimeCsv(text)
    : parseNetflixCsv(text);
  const db = getDb();
  const existingRows = db
    .prepare("SELECT * FROM watched_titles")
    .all() as WatchedTitleRow[];
  const existingByNormalized = new Map(
    existingRows.map((row) => [row.normalized_title, row]),
  );
  const mergedSource = mergeSourceFilename(
    getHistoryMeta()?.source_filename,
    sourceFilename,
  );

  const upsert = db.prepare(`
    INSERT INTO watched_titles (
      raw_title, normalized_title, last_watched_at, play_count,
      tmdb_id, status, candidates_json
    ) VALUES (
      @rawTitle, @normalizedTitle, @lastWatchedAt, @playCount,
      @tmdbId, @status, @candidatesJson
    )
    ON CONFLICT(normalized_title) DO UPDATE SET
      raw_title = excluded.raw_title,
      last_watched_at = excluded.last_watched_at,
      play_count = excluded.play_count,
      tmdb_id = excluded.tmdb_id,
      status = excluded.status,
      candidates_json = excluded.candidates_json
  `);

  let searched = 0;
  const write = db.transaction((rows: Array<ParsedMovie & {
    tmdbId: number | null;
    status: WatchedTitleRow["status"];
    candidates: MatchCandidate[];
  }>) => {
    for (const row of rows) {
      const existing = existingByNormalized.get(normalizeTitle(row.rawTitle));
      upsert.run({
        rawTitle: row.rawTitle,
        normalizedTitle: normalizeTitle(row.rawTitle),
        lastWatchedAt: laterWatchedAt(existing?.last_watched_at, row.watchedAt),
        playCount: Math.max(existing?.play_count ?? 0, row.playCount),
        tmdbId: row.tmdbId,
        status: row.status,
        candidatesJson: JSON.stringify(row.candidates),
      });
    }
    const total = db
      .prepare("SELECT COUNT(*) AS count FROM watched_titles")
      .get() as { count: number };
    db.prepare(
      `
      INSERT INTO history_meta (
        id, uploaded_at, source_filename, movie_row_count, dropped_row_count
      ) VALUES (1, @uploadedAt, @sourceFilename, @movieRowCount, @droppedRowCount)
      ON CONFLICT(id) DO UPDATE SET
        uploaded_at = excluded.uploaded_at,
        source_filename = excluded.source_filename,
        movie_row_count = excluded.movie_row_count,
        dropped_row_count = excluded.dropped_row_count
    `,
    ).run({
      uploadedAt: new Date().toISOString(),
      sourceFilename: mergedSource,
      movieRowCount: total.count,
      droppedRowCount: parsed.dropped.length,
    });
  });

  const resolved = [];
  for (const movie of parsed.movies) {
    const existing = existingByNormalized.get(normalizeTitle(movie.rawTitle));
    const result = await resolveTitle(movie, existing);
    if (result.searched) {
      searched += 1;
    }
    resolved.push({ ...movie, ...result });
  }

  write(resolved);

  const counts = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) AS matched,
        SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS ignored
      FROM watched_titles
    `,
    )
    .get() as { matched: number; review: number; ignored: number };

  return {
    movieRowCount: parsed.movies.length,
    droppedRowCount: parsed.dropped.length,
    matched: counts.matched ?? 0,
    review: counts.review ?? 0,
    ignored: counts.ignored ?? 0,
    searched,
  };
}

export function listReviewItems(): Array<{
  id: number;
  rawTitle: string;
  lastWatchedAt: string | null;
  candidates: MatchCandidate[];
}> {
  const rows = getDb()
    .prepare(
      `
      SELECT id, raw_title, last_watched_at, candidates_json
      FROM watched_titles
      WHERE status = 'review'
      ORDER BY raw_title COLLATE NOCASE
    `,
    )
    .all() as Array<{
    id: number;
    raw_title: string;
    last_watched_at: string | null;
    candidates_json: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    rawTitle: row.raw_title,
    lastWatchedAt: row.last_watched_at,
    candidates: parseCandidates(row.candidates_json),
  }));
}

export function resolveMatch(input: {
  id: number;
  action: "match" | "ignore";
  tmdbId?: number;
}): void {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM watched_titles WHERE id = ?")
    .get(input.id) as WatchedTitleRow | undefined;

  if (!row) {
    throw new Error("Match item not found.");
  }

  if (input.action === "ignore") {
    db.prepare(
      "UPDATE watched_titles SET status = 'ignored', tmdb_id = NULL WHERE id = ?",
    ).run(input.id);
    return;
  }

  if (!input.tmdbId) {
    throw new Error("A TMDB id is required to confirm a match.");
  }

  db.prepare(
    "UPDATE watched_titles SET status = 'matched', tmdb_id = ? WHERE id = ?",
  ).run(input.tmdbId, input.id);
}

export function markCatalogMovieWatched(tmdbId: number): { tmdbId: number; title: string } {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error("A valid TMDB id is required.");
  }

  const db = getDb();
  const movie = db
    .prepare("SELECT * FROM catalog_movies WHERE tmdb_id = ?")
    .get(tmdbId) as CatalogMovieRow | undefined;

  if (!movie) {
    throw new Error("That title is not in a loaded catalog.");
  }

  const alreadyMatched = db
    .prepare("SELECT id FROM watched_titles WHERE tmdb_id = ? AND status = 'matched'")
    .get(tmdbId) as { id: number } | undefined;
  if (alreadyMatched) {
    return { tmdbId: movie.tmdb_id, title: movie.title };
  }

  const candidates = JSON.stringify([
    {
      tmdbId: movie.tmdb_id,
      title: movie.title,
      originalTitle: movie.original_title,
      releaseYear: movie.release_year,
      posterPath: movie.poster_path,
      popularity: movie.popularity,
    },
  ]);

  db.prepare(
    `
    INSERT INTO watched_titles (
      raw_title, normalized_title, last_watched_at, play_count,
      tmdb_id, status, candidates_json
    ) VALUES (?, ?, ?, 1, ?, 'matched', ?)
    ON CONFLICT(normalized_title) DO UPDATE SET
      last_watched_at = excluded.last_watched_at,
      play_count = watched_titles.play_count + 1,
      tmdb_id = excluded.tmdb_id,
      status = 'matched',
      candidates_json = excluded.candidates_json
  `,
  ).run(
    movie.title,
    normalizeTitle(movie.title),
    new Date().toISOString(),
    movie.tmdb_id,
    candidates,
  );

  return { tmdbId: movie.tmdb_id, title: movie.title };
}

export function rematchAgainstCatalog(): { reviewed: number; matched: number } {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM watched_titles WHERE status = 'review'")
    .all() as WatchedTitleRow[];
  const update = db.prepare(
    "UPDATE watched_titles SET tmdb_id = ?, status = ?, candidates_json = ? WHERE id = ?",
  );

  let matched = 0;
  for (const row of rows) {
    const candidates = findCatalogMatches(row.raw_title);
    const auto = pickAutoMatch(row.raw_title, candidates);
    if (auto) {
      matched += 1;
      update.run(auto.tmdbId, "matched", JSON.stringify(candidates), row.id);
    }
  }

  return { reviewed: rows.length, matched };
}

export async function retryUnmatchedSearches(): Promise<{ searched: number; matched: number }> {
  if (!getTmdbApiKey()) {
    throw new Error("TMDB_API_KEY is not set. Add it to auth.json or paste it on Setup.");
  }

  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM watched_titles WHERE status = 'review'")
    .all() as WatchedTitleRow[];

  let searched = 0;
  let matched = 0;
  const update = db.prepare(
    "UPDATE watched_titles SET tmdb_id = ?, status = ?, candidates_json = ? WHERE id = ?",
  );

  for (const row of rows) {
    const candidates = await searchMovies(row.raw_title);
    const auto = pickAutoMatch(row.raw_title, candidates);
    searched += 1;
    if (auto) {
      matched += 1;
      update.run(auto.tmdbId, "matched", JSON.stringify(candidates), row.id);
    } else {
      update.run(null, "review", JSON.stringify(candidates), row.id);
    }
  }

  return { searched, matched };
}
