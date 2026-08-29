import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, countByStatus, getDb, getHistoryMeta } from "@/lib/db";
import { importHistoryFile, importViewingCsv, markCatalogMovieWatched } from "@/lib/history";
import { loadSampleCatalog } from "@/lib/sample-catalog";
import { exportUnseenCsv, queryUnseen } from "@/lib/unseen";

const simpleCsv = `Title,Date
The Matrix,8/1/24
The Office: Season 1: Episode 1: Pilot,8/2/24
Definitely Not A Real Movie Title 1999,8/3/24
`;

describe("catalog minus watched history", () => {
  beforeEach(() => {
    process.env.UNSEEN_DB_PATH = ":memory:";
    closeDb();
    getDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("auto-matches an exact catalog title and leaves unmatched titles for review", async () => {
    loadSampleCatalog();
    const summary = await importViewingCsv(simpleCsv, "viewing-activity.csv");

    expect(summary.movieRowCount).toBe(2);
    expect(summary.droppedRowCount).toBe(1);
    expect(summary.matched).toBe(1);
    expect(summary.review).toBe(1);

    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    expect(unseen.items.map((movie) => movie.title)).toEqual([
      "Fight Club",
      "Parasite",
      "Spider-Man: Into the Spider-Verse",
    ]);
    expect(unseen.items.some((movie) => movie.title === "The Matrix")).toBe(false);
    expect(unseen.items[0]?.year).toBeTruthy();
    expect(unseen.items[0]?.services.map((service) => service.slug)).toContain("netflix");
    expect(
      unseen.items.find((movie) => movie.title === "Fight Club")?.services,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "netflix",
          watchUrl: "https://www.netflix.com/search?q=Fight%20Club",
        }),
      ]),
    );
  });

  it("marks an unseen catalog movie as watched and drops it from the list", () => {
    loadSampleCatalog();
    const marked = markCatalogMovieWatched(550);

    expect(marked).toEqual({ tmdbId: 550, title: "Fight Club" });
    expect(countByStatus("matched")).toBe(1);

    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    expect(unseen.items.map((movie) => movie.title)).toEqual([
      "Parasite",
      "Spider-Man: Into the Spider-Verse",
      "The Matrix",
    ]);
  });

  it("keeps a manual watched mark when the Netflix CSV is re-imported", async () => {
    loadSampleCatalog();
    markCatalogMovieWatched(550);
    await importViewingCsv(simpleCsv, "viewing-activity.csv");

    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    expect(unseen.items.map((movie) => movie.title)).toEqual([
      "Parasite",
      "Spider-Man: Into the Spider-Verse",
    ]);
    expect(countByStatus("matched")).toBe(2);
  });

  it("exports unseen movies as CSV with a Services column", async () => {
    loadSampleCatalog();
    await importViewingCsv(simpleCsv, "viewing-activity.csv");
    const csv = exportUnseenCsv();
    expect(csv).toContain("Services");
    expect(csv).toContain("Watch URLs");
    expect(csv).toContain("Fight Club");
    expect(csv).toContain("Netflix");
    expect(csv).toContain("https://www.netflix.com/search?q=Fight%20Club");
    expect(csv).not.toContain("The Matrix");
  });

  it("merges Prime ZIP movies into the same seen list without replacing Netflix matches", async () => {
    loadSampleCatalog();
    await importViewingCsv(simpleCsv, "viewing-activity.csv");

    const bytes = readFileSync(path.join(process.cwd(), "fixtures/prime-video.zip"));
    const summary = await importHistoryFile({
      filename: "prime-video.zip",
      bytes,
    });

    expect(summary.movieRowCount).toBe(2);
    expect(summary.droppedRowCount).toBe(5);
    expect(countByStatus("matched")).toBe(2);
    expect(countByStatus("review")).toBe(1);
    expect(getHistoryMeta()?.source_filename).toBe(
      "viewing-activity.csv, prime-video.zip",
    );

    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    expect(unseen.items.map((movie) => movie.title)).toEqual([
      "Fight Club",
      "Spider-Man: Into the Spider-Verse",
    ]);
  });

  it("ignores Metascores unless the title has at least 100 IMDb votes", () => {
    loadSampleCatalog();
    const db = getDb();
    db.prepare(
      "UPDATE catalog_movies SET metascore = ?, imdb_votes = ? WHERE tmdb_id = ?",
    ).run(96, 2_000_000, 496243);
    db.prepare(
      "UPDATE catalog_movies SET metascore = ?, imdb_votes = ? WHERE tmdb_id = ?",
    ).run(90, 12, 550);
    db.prepare(
      "UPDATE catalog_movies SET metascore = ?, imdb_votes = ? WHERE tmdb_id = ?",
    ).run(73, 1_500_000, 603);

    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    const byTitle = Object.fromEntries(unseen.items.map((movie) => [movie.title, movie.rating]));
    expect(byTitle.Parasite).toBe(96);
    expect(byTitle["Fight Club"]).toBeNull();
    expect(byTitle["The Matrix"]).toBe(73);

    const filtered = queryUnseen({ ratingMin: 80, sort: "title", order: "asc", pageSize: 50 });
    expect(filtered.items.map((movie) => movie.title)).toEqual(["Parasite"]);

    const ranked = queryUnseen({ sort: "rating", order: "desc", pageSize: 50 });
    expect(ranked.items.map((movie) => movie.title)).toEqual([
      "Parasite",
      "The Matrix",
      "Fight Club",
      "Spider-Man: Into the Spider-Verse",
    ]);
  });

  it("excludes titles without a trusted Metascore when a minimum is set", () => {
    loadSampleCatalog();
    const db = getDb();
    db.prepare(
      "UPDATE catalog_movies SET metascore = ?, imdb_votes = ? WHERE tmdb_id = ?",
    ).run(73, 1_500_000, 603);

    const anyRated = queryUnseen({
      ratingMin: 0,
      sort: "title",
      order: "asc",
      pageSize: 50,
    });
    expect(anyRated.items.map((movie) => movie.title)).toEqual(["The Matrix"]);

    const high = queryUnseen({ ratingMin: 80, sort: "title", order: "asc", pageSize: 50 });
    expect(high.items).toEqual([]);
  });
});
