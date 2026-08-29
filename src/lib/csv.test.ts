import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyViewingRow,
  parseDurationSeconds,
  parseNetflixCsv,
} from "@/lib/csv";

const fixtures = path.join(process.cwd(), "fixtures");

describe("classifyViewingRow", () => {
  it("keeps movie titles that contain a colon", () => {
    expect(
      classifyViewingRow({ title: "Spider-Man: Into the Spider-Verse" }),
    ).toBeNull();
  });

  it("drops TV-shaped titles", () => {
    expect(
      classifyViewingRow({
        title: "The Office: Season 1: Episode 1: Pilot",
      }),
    ).toBe("tv");
    expect(classifyViewingRow({ title: "Bridgerton: Limited Series" })).toBe("tv");
    expect(classifyViewingRow({ title: "Fake Show - Season 3" })).toBe("tv");
  });

  it("drops trailers and very short plays", () => {
    expect(
      classifyViewingRow({ title: "The Matrix", supplementalType: "TRAILER" }),
    ).toBe("clip");
    expect(classifyViewingRow({ title: "Fight Club", duration: "0:00:18" })).toBe(
      "short",
    );
  });
});

describe("parseDurationSeconds", () => {
  it("parses hh:mm:ss", () => {
    expect(parseDurationSeconds("1:45:12")).toBe(6312);
  });
});

describe("parseNetflixCsv", () => {
  it("keeps movies and drops TV rows from the simple export", () => {
    const text = readFileSync(path.join(fixtures, "viewing-activity.csv"), "utf8");
    const result = parseNetflixCsv(text);

    expect(result.movies.map((movie) => movie.rawTitle)).toEqual([
      "The Matrix",
      "Definitely Not A Real Movie Title 1999",
    ]);
    expect(result.dropped.some((row) => row.reason === "tv")).toBe(true);
  });

  it("uses duration and supplemental type from the full export", () => {
    const text = readFileSync(
      path.join(fixtures, "viewing-activity-full.csv"),
      "utf8",
    );
    const result = parseNetflixCsv(text);

    expect(result.movies.map((movie) => movie.rawTitle)).toEqual([
      "The Matrix",
      "Parasite",
    ]);
    expect(result.dropped.map((row) => row.reason).sort()).toEqual([
      "clip",
      "short",
      "tv",
    ]);
  });
});
