import { describe, expect, it } from "vitest";
import { watchUrlForTitle } from "@/lib/services";

describe("watchUrlForTitle", () => {
  it("opens each service's title search for the movie name", () => {
    expect(watchUrlForTitle("netflix", "The Matrix")).toBe(
      "https://www.netflix.com/search?q=The%20Matrix",
    );
    expect(watchUrlForTitle("prime", "The Matrix")).toBe(
      "https://www.primevideo.com/search?phrase=The%20Matrix",
    );
    expect(watchUrlForTitle("disney", "Encanto")).toBe(
      "https://www.disneyplus.com/browse/search?q=Encanto",
    );
    expect(watchUrlForTitle("max", "Dune")).toBe("https://play.max.com/search?q=Dune");
  });

  it("encodes punctuation in titles", () => {
    expect(watchUrlForTitle("netflix", "Spider-Man: Into the Spider-Verse")).toBe(
      "https://www.netflix.com/search?q=Spider-Man%3A%20Into%20the%20Spider-Verse",
    );
  });

  it("returns null for blank titles and unknown services", () => {
    expect(watchUrlForTitle("netflix", "   ")).toBeNull();
    expect(watchUrlForTitle("hulu", "The Matrix")).toBeNull();
  });
});
