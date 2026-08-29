import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CATALOG_SERVICES, NETFLIX_PROVIDER_ID } from "@/lib/services";

const DATA_DIR = path.join(process.cwd(), "data");

function dbPath() {
  return process.env.UNSEEN_DB_PATH ?? path.join(DATA_DIR, "unseen.sqlite");
}

type Statement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

export type AppDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
  transaction: <T>(fn: (arg: T) => void) => (arg: T) => void;
  close: () => void;
};

type GlobalDb = typeof globalThis & {
  __unseenDb?: AppDatabase;
};

function asPlain<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function wrapDb(raw: DatabaseSync): AppDatabase {
  return {
    exec: (sql) => {
      raw.exec(sql);
    },
    prepare: (sql) => {
      const statement = raw.prepare(sql);
      return {
        run: (...params) => statement.run(...params),
        get: (...params) => asPlain(statement.get(...params)),
        all: (...params) => asPlain(statement.all(...params)),
      };
    },
    transaction: (fn) => (arg) => {
      raw.exec("BEGIN");
      try {
        fn(arg);
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => raw.close(),
  };
}

function tableExists(db: AppDatabase, name: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { ok: number } | undefined;
  return Boolean(row);
}

function seedCatalogServices(db: AppDatabase) {
  const insert = db.prepare(`
    INSERT INTO catalog_services (provider_id, slug, name, refreshed_at, movie_count)
    VALUES (?, ?, ?, NULL, 0)
    ON CONFLICT(provider_id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name
  `);
  for (const service of CATALOG_SERVICES) {
    insert.run(service.providerId, service.slug, service.name);
  }
}

function migrateLegacyCatalog(db: AppDatabase) {
  const movieCount = (
    db.prepare("SELECT COUNT(*) AS count FROM catalog_movies").get() as { count: number }
  ).count;
  const availabilityCount = (
    db.prepare("SELECT COUNT(*) AS count FROM catalog_availability").get() as { count: number }
  ).count;

  if (movieCount > 0 && availabilityCount === 0) {
    db.prepare(
      "INSERT INTO catalog_availability (tmdb_id, provider_id) SELECT tmdb_id, ? FROM catalog_movies",
    ).run(NETFLIX_PROVIDER_ID);

    let refreshedAt: string | null = null;
    let count = movieCount;
    if (tableExists(db, "catalog_meta")) {
      const meta = db
        .prepare("SELECT refreshed_at, movie_count FROM catalog_meta WHERE id = 1")
        .get() as { refreshed_at: string; movie_count: number } | undefined;
      if (meta) {
        refreshedAt = meta.refreshed_at;
        count = meta.movie_count;
      }
    }

    db.prepare(
      `
      UPDATE catalog_services
      SET refreshed_at = ?, movie_count = ?
      WHERE provider_id = ?
    `,
    ).run(refreshedAt ?? new Date().toISOString(), count, NETFLIX_PROVIDER_ID);
  }

  if (tableExists(db, "catalog_meta")) {
    db.exec("DROP TABLE catalog_meta");
  }
}

function migrate(db: AppDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_movies (
      tmdb_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      original_title TEXT NOT NULL,
      release_year INTEGER,
      poster_path TEXT,
      genre_ids TEXT NOT NULL,
      popularity REAL NOT NULL,
      vote_average REAL NOT NULL,
      overview TEXT NOT NULL,
      imdb_id TEXT,
      metascore INTEGER,
      imdb_votes INTEGER,
      omdb_fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS catalog_services (
      provider_id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      refreshed_at TEXT,
      movie_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS catalog_availability (
      tmdb_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      PRIMARY KEY (tmdb_id, provider_id),
      FOREIGN KEY (tmdb_id) REFERENCES catalog_movies(tmdb_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watched_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_title TEXT NOT NULL,
      normalized_title TEXT NOT NULL UNIQUE,
      last_watched_at TEXT,
      play_count INTEGER NOT NULL DEFAULT 1,
      tmdb_id INTEGER,
      status TEXT NOT NULL CHECK (status IN ('matched', 'review', 'ignored')),
      candidates_json TEXT
    );

    CREATE TABLE IF NOT EXISTS history_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      uploaded_at TEXT NOT NULL,
      source_filename TEXT,
      movie_row_count INTEGER NOT NULL,
      dropped_row_count INTEGER NOT NULL
    );
  `);
  seedCatalogServices(db);
  migrateLegacyCatalog(db);
  ensureColumn(db, "catalog_movies", "imdb_id TEXT");
  ensureColumn(db, "catalog_movies", "metascore INTEGER");
  ensureColumn(db, "catalog_movies", "imdb_votes INTEGER");
  ensureColumn(db, "catalog_movies", "omdb_fetched_at TEXT");
}

function tableColumns(db: AppDatabase, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function ensureColumn(db: AppDatabase, table: string, definition: string) {
  const column = definition.split(/\s+/)[0];
  if (!column || tableColumns(db, table).has(column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

export function closeDb() {
  const globalDb = globalThis as GlobalDb;
  globalDb.__unseenDb?.close();
  globalDb.__unseenDb = undefined;
}

export function getDb(): AppDatabase {
  const globalDb = globalThis as GlobalDb;
  if (!globalDb.__unseenDb) {
    const filePath = dbPath();
    if (filePath !== ":memory:") {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    const raw = new DatabaseSync(filePath);
    raw.exec("PRAGMA journal_mode = WAL");
    raw.exec("PRAGMA foreign_keys = ON");
    const db = wrapDb(raw);
    globalDb.__unseenDb = db;
  }
  migrate(globalDb.__unseenDb);
  return globalDb.__unseenDb;
}

export type CatalogMovieRow = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number | null;
  poster_path: string | null;
  genre_ids: string;
  popularity: number;
  vote_average: number;
  overview: string;
  imdb_id: string | null;
  metascore: number | null;
  imdb_votes: number | null;
  omdb_fetched_at: string | null;
};

export type WatchedTitleRow = {
  id: number;
  raw_title: string;
  normalized_title: string;
  last_watched_at: string | null;
  play_count: number;
  tmdb_id: number | null;
  status: "matched" | "review" | "ignored";
  candidates_json: string | null;
};

export type CatalogServiceRow = {
  provider_id: number;
  slug: string;
  name: string;
  refreshed_at: string | null;
  movie_count: number;
};

export type HistoryMeta = {
  uploaded_at: string;
  source_filename: string | null;
  movie_row_count: number;
  dropped_row_count: number;
};

export function getCatalogServices(): CatalogServiceRow[] {
  return getDb()
    .prepare(
      `
      SELECT provider_id, slug, name, refreshed_at, movie_count
      FROM catalog_services
      ORDER BY provider_id
    `,
    )
    .all() as CatalogServiceRow[];
}

export function getRefreshedProviderIds(): number[] {
  return getCatalogServices()
    .filter((service) => service.refreshed_at)
    .map((service) => service.provider_id);
}

export function getHistoryMeta(): HistoryMeta | null {
  return (
    (getDb()
      .prepare(
        "SELECT uploaded_at, source_filename, movie_row_count, dropped_row_count FROM history_meta WHERE id = 1",
      )
      .get() as HistoryMeta | undefined) ?? null
  );
}

export function countByStatus(status: WatchedTitleRow["status"]): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM watched_titles WHERE status = ?")
    .get(status) as { count: number };
  return row.count;
}

export function countUnseen(providerIds?: number[]): number {
  const ids = providerIds ?? getRefreshedProviderIds();
  if (ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map((_, index) => `?`).join(", ");
  const row = getDb()
    .prepare(
      `
      SELECT COUNT(DISTINCT c.tmdb_id) AS count
      FROM catalog_movies c
      JOIN catalog_availability a ON a.tmdb_id = c.tmdb_id
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE w.id IS NULL
        AND a.provider_id IN (${placeholders})
    `,
    )
    .get(...ids) as { count: number };
  return row.count;
}
