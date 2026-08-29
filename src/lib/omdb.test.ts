import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import {
  enrichCatalogRatings,
  getOmdbApiKey,
  parseOmdbResponse,
} from "@/lib/omdb";
import { loadSampleCatalog } from "@/lib/sample-catalog";
import { queryUnseen } from "@/lib/unseen";

describe("OMDb Metascore lookup", () => {
  const previousKey = process.env.OMDB_API_KEY;

  beforeEach(() => {
    process.env.UNSEEN_DB_PATH = ":memory:";
    process.env.OMDB_API_KEY = "test-omdb-key";
    closeDb();
    getDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    closeDb();
    if (previousKey) {
      process.env.OMDB_API_KEY = previousKey;
    } else {
      delete process.env.OMDB_API_KEY;
    }
  });

  it("reads Metascore and IMDb vote counts from an OMDb payload", () => {
    expect(
      parseOmdbResponse({
        Response: "True",
        imdbID: "tt0133093",
        Metascore: "73",
        imdbVotes: "2,106,297",
      }),
    ).toEqual({
      imdbId: "tt0133093",
      metascore: 73,
      imdbVotes: 2_106_297,
    });
  });

  it("treats missing Metascore or a failed lookup as no rating", () => {
    expect(
      parseOmdbResponse({
        Response: "True",
        imdbID: "tt0133093",
        Metascore: "N/A",
        imdbVotes: "N/A",
      }),
    ).toEqual({
      imdbId: "tt0133093",
      metascore: null,
      imdbVotes: null,
    });
    expect(parseOmdbResponse({ Response: "False", Error: "Movie not found!" })).toBeNull();
  });

  it("stores OMDb ratings on catalog movies and skips titles already fetched", async () => {
    loadSampleCatalog();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const title = url.searchParams.get("t");
      if (title === "The Matrix") {
        return Response.json({
          Response: "True",
          imdbID: "tt0133093",
          Metascore: "73",
          imdbVotes: "2,106,297",
        });
      }
      if (title === "Fight Club") {
        return Response.json({
          Response: "True",
          imdbID: "tt0137523",
          Metascore: "66",
          imdbVotes: "12",
        });
      }
      return Response.json({ Response: "False", Error: "Movie not found!" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await enrichCatalogRatings();
    expect(first).toEqual({ fetched: 4, rated: 2 });
    const unseen = queryUnseen({ sort: "title", order: "asc", pageSize: 50 });
    expect(unseen.items.find((movie) => movie.title === "The Matrix")?.rating).toBe(73);
    expect(unseen.items.find((movie) => movie.title === "Fight Club")?.rating).toBeNull();
    expect(unseen.items.find((movie) => movie.title === "Parasite")?.rating).toBeNull();

    const second = await enrichCatalogRatings();
    expect(second).toEqual({ fetched: 0, rated: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not call OMDb when the API key is missing", async () => {
    delete process.env.OMDB_API_KEY;
    expect(getOmdbApiKey()).toBeNull();
    loadSampleCatalog();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await enrichCatalogRatings()).toEqual({ fetched: 0, rated: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
