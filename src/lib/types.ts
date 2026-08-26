export type UnseenSort = "popularity" | "year" | "rating" | "title";

export type UnseenMovie = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  genreIds: number[];
  popularity: number;
  voteAverage: number;
  overview: string;
  tmdbUrl: string;
};

export type UnseenPage = {
  items: UnseenMovie[];
  total: number;
  page: number;
  pageSize: number;
  genres: { id: number; name: string }[];
};

export type AppStatus = {
  tmdbConfigured: boolean;
  catalog: { refreshed_at: string; movie_count: number } | null;
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
};
