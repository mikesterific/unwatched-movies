import { replaceCatalog } from "@/lib/catalog";
import type { TmdbMovie } from "@/lib/tmdb";

export const SAMPLE_CATALOG: TmdbMovie[] = [
  {
    tmdbId: 603,
    title: "The Matrix",
    originalTitle: "The Matrix",
    releaseYear: 1999,
    posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    genreIds: [28, 878],
    popularity: 90,
    voteAverage: 8.2,
    overview: "A computer hacker learns about the true nature of reality.",
  },
  {
    tmdbId: 550,
    title: "Fight Club",
    originalTitle: "Fight Club",
    releaseYear: 1999,
    posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    genreIds: [18],
    popularity: 80,
    voteAverage: 8.4,
    overview: "An insomniac office worker and a soap maker form an underground club.",
  },
  {
    tmdbId: 496243,
    title: "Parasite",
    originalTitle: "기생충",
    releaseYear: 2019,
    posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    genreIds: [18, 53, 35],
    popularity: 85,
    voteAverage: 8.5,
    overview: "Greed and class discrimination threaten the relationship between two families.",
  },
  {
    tmdbId: 324857,
    title: "Spider-Man: Into the Spider-Verse",
    originalTitle: "Spider-Man: Into the Spider-Verse",
    releaseYear: 2018,
    posterPath: "/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    genreIds: [16, 28, 12],
    popularity: 88,
    voteAverage: 8.4,
    overview: "Teen Miles Morales becomes the Spider-Man of his universe.",
  },
];

export function loadSampleCatalog() {
  return replaceCatalog(SAMPLE_CATALOG);
}
