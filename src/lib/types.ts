export type UnseenSort = "popularity" | "year" | "rating" | "title";

export type ServiceLabel = {
  slug: string;
  name: string;
  watchUrl?: string;
};

export type UnseenMovie = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  genreIds: number[];
  popularity: number;
  rating: number | null;
  overview: string;
  tmdbUrl: string;
  services: ServiceLabel[];
  watched: boolean;
};

export type UnseenPage = {
  items: UnseenMovie[];
  total: number;
  page: number;
  pageSize: number;
  genres: { id: number; name: string }[];
  services: ServiceLabel[];
};

export type CatalogServiceStatus = {
  slug: string;
  name: string;
  refreshed_at: string | null;
  movie_count: number;
};

export type AppStatus = {
  tmdbConfigured: boolean;
  omdbConfigured: boolean;
  services: CatalogServiceStatus[];
  history: {
    uploaded_at: string;
    source_filename: string | null;
    movie_row_count: number;
    dropped_row_count: number;
  } | null;
  matchedCount: number;
  reviewCount: number;
  ignoredCount: number;
  unseenCount: number;
  projectCsv: {
    present: boolean;
    filename: string;
  };
  projectPrime: {
    present: boolean;
    filename: string;
  };
  netflixAuth: {
    present: boolean;
  };
};
