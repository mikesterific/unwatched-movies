import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractPrimeViewingHistory,
  parsePrimeCsv,
} from "@/lib/prime-csv";

const fixtures = path.join(process.cwd(), "fixtures");

describe("parsePrimeCsv", () => {
  it("keeps Full and Feature movies and drops TV, promos, trailers, and short plays", () => {
    const text = readFileSync(
      path.join(fixtures, "prime-viewing-history.csv"),
      "utf8",
    );
    const result = parsePrimeCsv(text);

    expect(result.movies.map((movie) => movie.rawTitle)).toEqual([
      "The Matrix",
      "Parasite",
    ]);
    expect(result.movies[0]).toMatchObject({
      playCount: 2,
      watchedAt: "2026-08-24T08:34:19Z",
    });
    expect(result.dropped.map((row) => row.reason).sort()).toEqual([
      "clip",
      "clip",
      "short",
      "tv",
      "tv",
    ]);
  });

  it("drops trailer entitlements even when the material type is Full", () => {
    const result = parsePrimeCsv(`Title,"Material Type Description","Entitlement Type Code","Seconds Viewed","Playback Start Datetime (UTC)"
"""The Matrix""","""Full""","""TRAILER""",5000.00000,2026-06-06T20:00:00Z
`);
    expect(result.movies).toEqual([]);
    expect(result.dropped).toEqual([{ title: "The Matrix", reason: "clip" }]);
  });
});

describe("extractPrimeViewingHistory", () => {
  it("reads Viewing History.csv from the official ZIP layout", async () => {
    const bytes = readFileSync(path.join(fixtures, "prime-video.zip"));
    const text = await extractPrimeViewingHistory(bytes);
    const result = parsePrimeCsv(text);
    expect(result.movies.map((movie) => movie.rawTitle)).toEqual([
      "The Matrix",
      "Parasite",
    ]);
  });
});
