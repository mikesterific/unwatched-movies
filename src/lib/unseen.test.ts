import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { importViewingCsv } from "@/lib/history";
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
    const db = getDb();
    db.exec(`
      DELETE FROM catalog_movies;
      DELETE FROM catalog_meta;
      DELETE FROM watched_titles;
      DELETE FROM history_meta;
    `);
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
  });

  it("exports unseen movies as CSV", async () => {
    loadSampleCatalog();
    await importViewingCsv(simpleCsv, "viewing-activity.csv");
    const csv = exportUnseenCsv();
    expect(csv).toContain("Fight Club");
    expect(csv).not.toContain("The Matrix");
  });
});
