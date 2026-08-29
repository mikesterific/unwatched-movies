import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listAvailability, replaceServiceCatalog } from "@/lib/catalog";
import { closeDb, getDb } from "@/lib/db";
import { SAMPLE_CATALOG, loadSampleCatalog } from "@/lib/sample-catalog";
import { NETFLIX_PROVIDER_ID } from "@/lib/services";
import type { TmdbMovie } from "@/lib/tmdb";
import { queryUnseen } from "@/lib/unseen";

const PRIME_ONLY: TmdbMovie = {
  tmdbId: 11,
  title: "Star Wars",
  originalTitle: "Star Wars",
  releaseYear: 1977,
  posterPath: null,
  genreIds: [12],
  popularity: 70,
  voteAverage: 8.2,
  overview: "A farm boy joins a rebellion.",
};

describe("per-service catalogs", () => {
  beforeEach(() => {
    process.env.UNSEEN_DB_PATH = ":memory:";
    closeDb();
    getDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("keeps Netflix availability when Prime is refreshed", () => {
    loadSampleCatalog();
    replaceServiceCatalog("prime", [SAMPLE_CATALOG[0], PRIME_ONLY]);

    const netflixIds = listAvailability(NETFLIX_PROVIDER_ID).map((row) => row.tmdb_id);
    const primeIds = listAvailability(9).map((row) => row.tmdb_id);

    expect(netflixIds).toEqual(expect.arrayContaining(SAMPLE_CATALOG.map((movie) => movie.tmdbId)));
    expect(primeIds).toEqual(expect.arrayContaining([603, 11]));

    const netflixUnseen = queryUnseen({
      providers: ["netflix"],
      sort: "title",
      order: "asc",
      pageSize: 50,
    });
    expect(netflixUnseen.items.map((movie) => movie.title)).toEqual([
      "Fight Club",
      "Parasite",
      "Spider-Man: Into the Spider-Verse",
      "The Matrix",
    ]);

    const primeUnseen = queryUnseen({
      providers: ["prime"],
      sort: "title",
      order: "asc",
      pageSize: 50,
    });
    expect(primeUnseen.items.map((movie) => movie.title)).toEqual(["Star Wars", "The Matrix"]);
    expect(primeUnseen.items.find((movie) => movie.title === "The Matrix")?.services.map((s) => s.slug)).toEqual(
      expect.arrayContaining(["netflix", "prime"]),
    );
  });

  it("backfills Netflix availability for a legacy catalog with no availability rows", () => {
    const filePath = path.join(mkdtempSync(path.join(tmpdir(), "unseen-legacy-")), "legacy.sqlite");
    process.env.UNSEEN_DB_PATH = filePath;
    closeDb();
    const db = getDb();
    db.prepare(
      `
      INSERT INTO catalog_movies (
        tmdb_id, title, original_title, release_year, poster_path,
        genre_ids, popularity, vote_average, overview
      ) VALUES (603, 'The Matrix', 'The Matrix', 1999, NULL, ',28,', 90, 8.2, 'Legacy row')
    `,
    ).run();
    const pending = db
      .prepare("SELECT COUNT(*) AS count FROM catalog_availability")
      .get() as { count: number };
    expect(pending.count).toBe(0);

    expect(listAvailability()).toEqual([{ tmdb_id: 603, provider_id: NETFLIX_PROVIDER_ID }]);
    closeDb();
    getDb();

    expect(listAvailability()).toEqual([{ tmdb_id: 603, provider_id: NETFLIX_PROVIDER_ID }]);
    const unseen = queryUnseen({ sort: "title", order: "asc" });
    expect(unseen.items.map((movie) => movie.title)).toEqual(["The Matrix"]);
  });
});
