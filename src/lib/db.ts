import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
      overview TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      refreshed_at TEXT NOT NULL,
      movie_count INTEGER NOT NULL
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
    migrate(db);
    globalDb.__unseenDb = db;
  }
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

export type CatalogMeta = {
  refreshed_at: string;
  movie_count: number;
};

export type HistoryMeta = {
  uploaded_at: string;
  source_filename: string | null;
  movie_row_count: number;
  dropped_row_count: number;
};

export function getCatalogMeta(): CatalogMeta | null {
  return (
    (getDb()
      .prepare("SELECT refreshed_at, movie_count FROM catalog_meta WHERE id = 1")
      .get() as CatalogMeta | undefined) ?? null
  );
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

export function countUnseen(): number {
  const row = getDb()
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM catalog_movies c
      LEFT JOIN watched_titles w
        ON w.tmdb_id = c.tmdb_id AND w.status = 'matched'
      WHERE w.id IS NULL
    `,
    )
    .get() as { count: number };
  return row.count;
}
