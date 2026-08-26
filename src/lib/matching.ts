import { normalizeTitle } from "@/lib/normalize";

export type MatchCandidate = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterPath: string | null;
  popularity: number;
};

export function pickAutoMatch(
  query: string,
  candidates: MatchCandidate[],
): MatchCandidate | null {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery || candidates.length === 0) {
    return null;
  }

  const exact = candidates.filter((candidate) => {
    return (
      normalizeTitle(candidate.title) === normalizedQuery ||
      normalizeTitle(candidate.originalTitle) === normalizedQuery
    );
  });

  if (exact.length === 1) {
    return exact[0];
  }

  return null;
}

export function subtractUnseen<T extends { tmdbId: number }>(
  catalog: T[],
  watchedTmdbIds: Iterable<number>,
): T[] {
  const watched = new Set(watchedTmdbIds);
  return catalog.filter((movie) => !watched.has(movie.tmdbId));
}
