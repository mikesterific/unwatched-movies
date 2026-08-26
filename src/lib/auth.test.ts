import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStoredTmdbApiKey, readAuthKeys, writeAuthKeys } from "@/lib/auth";

describe("local auth.json", () => {
  const previousAuthPath = process.env.AUTH_JSON_PATH;
  const previousEnvKey = process.env.TMDB_API_KEY;

  beforeEach(() => {
    const dir = mkdtempSync(path.join(tmpdir(), "unseen-auth-"));
    process.env.AUTH_JSON_PATH = path.join(dir, "auth.json");
    delete process.env.TMDB_API_KEY;
  });

  afterEach(() => {
    if (previousAuthPath) {
      process.env.AUTH_JSON_PATH = previousAuthPath;
    } else {
      delete process.env.AUTH_JSON_PATH;
    }
    if (previousEnvKey) {
      process.env.TMDB_API_KEY = previousEnvKey;
    } else {
      delete process.env.TMDB_API_KEY;
    }
  });

  it("returns empty keys when the file is missing", () => {
    expect(readAuthKeys()).toEqual({ tmdbApiKey: "" });
    expect(getStoredTmdbApiKey()).toBeNull();
  });

  it("reads a saved TMDB key from auth.json", () => {
    writeAuthKeys({ tmdbApiKey: "  abc123  " });
    expect(readAuthKeys()).toEqual({ tmdbApiKey: "abc123" });
    expect(getStoredTmdbApiKey()).toBe("abc123");
  });

  it("falls back to TMDB_API_KEY when auth.json is empty", () => {
    process.env.TMDB_API_KEY = "from-env";
    expect(getStoredTmdbApiKey()).toBe("from-env");
  });
});
