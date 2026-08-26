import { describe, expect, it } from "vitest";
import { pickAutoMatch, subtractUnseen } from "@/lib/matching";
import { normalizeTitle } from "@/lib/normalize";

describe("normalizeTitle", () => {
  it("strips punctuation, ampersands, and a leading the", () => {
    expect(normalizeTitle("The Lord of the Rings: The Two Towers")).toBe(
      "lord of the rings the two towers",
    );
    expect(normalizeTitle("Crazy Rich & Famous")).toBe("crazy rich and famous");
  });
});

describe("pickAutoMatch", () => {
  const matrix = {
    tmdbId: 603,
    title: "The Matrix",
    originalTitle: "The Matrix",
    releaseYear: 1999,
    posterPath: null,
    popularity: 90,
  };
  const remake = {
    tmdbId: 999,
    title: "The Matrix",
    originalTitle: "The Matrix",
    releaseYear: 2026,
    posterPath: null,
    popularity: 10,
  };
  const reloaded = {
    tmdbId: 604,
    title: "The Matrix Reloaded",
    originalTitle: "The Matrix Reloaded",
    releaseYear: 2003,
    posterPath: null,
    popularity: 70,
  };

  it("auto-accepts a single exact title", () => {
    expect(pickAutoMatch("The Matrix", [matrix, reloaded])).toEqual(matrix);
  });

  it("sends remakes with the same title to review", () => {
    expect(pickAutoMatch("The Matrix", [matrix, remake])).toBeNull();
  });

  it("does not guess from a close but different title", () => {
    expect(pickAutoMatch("The Matrix", [reloaded])).toBeNull();
  });
});

describe("subtractUnseen", () => {
  it("removes watched TMDB ids from the catalog", () => {
    const catalog = [
      { tmdbId: 603, title: "The Matrix" },
      { tmdbId: 550, title: "Fight Club" },
    ];
    expect(subtractUnseen(catalog, [603])).toEqual([
      { tmdbId: 550, title: "Fight Club" },
    ]);
  });
});
