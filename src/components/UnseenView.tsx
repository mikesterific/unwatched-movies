"use client";

import Image from "next/image";
import { useState } from "react";
import type { UnseenPage, UnseenSort } from "@/lib/types";

const PAGE_SIZE = 24;

export function UnseenView({ initialData }: { initialData: UnseenPage }) {
  const [data, setData] = useState<UnseenPage>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [ratingMin, setRatingMin] = useState("");
  const [sort, setSort] = useState<UnseenSort>("popularity");
  const [page, setPage] = useState(1);

  async function load(next: {
    q?: string;
    genre?: string;
    yearMin?: string;
    ratingMin?: string;
    sort?: UnseenSort;
    page?: number;
  }) {
    const nextQ = next.q ?? q;
    const nextGenre = next.genre ?? genre;
    const nextYearMin = next.yearMin ?? yearMin;
    const nextRatingMin = next.ratingMin ?? ratingMin;
    const nextSort = next.sort ?? sort;
    const nextPage = next.page ?? page;
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
      sort: nextSort,
      order: nextSort === "title" ? "asc" : "desc",
    });
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextGenre) params.set("genre", nextGenre);
    if (nextYearMin) params.set("yearMin", nextYearMin);
    if (nextRatingMin) params.set("ratingMin", nextRatingMin);
    try {
      const response = await fetch(`/api/unseen?${params}`);
      setData((await response.json()) as UnseenPage);
      setError(null);
    } catch {
      setError("Could not load unseen movies.");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">Movies you have not watched</h2>
          <p className="text-sm text-muted">
            {data.total} titles on Netflix US minus your
            CSV.
          </p>
        </div>
        <a
          href="/api/unseen/export"
          className="rounded-full border border-line px-4 py-2 text-sm text-accent-2 hover:bg-paper"
        >
          Export CSV
        </a>
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-paper p-4 md:grid-cols-5">
        <label className="text-sm">
          <span className="text-muted">Search</span>
          <input
            value={q}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setQ(value);
              void load({ q: value, page: 1 });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
            placeholder="Title"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted">Genre</span>
          <select
            value={genre}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setGenre(value);
              void load({ genre: value, page: 1 });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
          >
            <option value="">All</option>
            {data.genres.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Year from</span>
          <input
            type="number"
            value={yearMin}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setYearMin(value);
              void load({ yearMin: value, page: 1 });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
            placeholder="1999"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted">Min rating</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={ratingMin}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setRatingMin(value);
              void load({ ratingMin: value, page: 1 });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
            placeholder="7"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted">Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              const value = event.target.value as UnseenSort;
              setSort(value);
              void load({ sort: value });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
          >
            <option value="popularity">Popularity</option>
            <option value="year">Year</option>
            <option value="rating">Rating</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      {data.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-muted">
          Nothing to show yet. Refresh the catalog and upload your viewing CSV
          on Setup. If the catalog is loaded and this is empty, every current
          title is marked watched.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((movie) => (
            <li
              key={movie.tmdbId}
              className="flex gap-4 rounded-2xl border border-line bg-paper p-4"
            >
              {movie.posterUrl ? (
                <Image
                  src={movie.posterUrl}
                  alt=""
                  width={80}
                  height={112}
                  className="h-28 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-xs text-muted">
                  No art
                </div>
              )}
              <div className="min-w-0">
                <a
                  href={movie.tmdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-lg leading-tight hover:text-accent-2"
                >
                  {movie.title}
                </a>
                <p className="mt-1 text-sm text-muted">
                  {[movie.year, movie.voteAverage ? movie.voteAverage.toFixed(1) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-muted">
                  {movie.genres.join(" / ") || "Uncategorized"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const nextPage = page - 1;
              setPage(nextPage);
              void load({ page: nextPage });
            }}
            className="rounded-full border border-line px-4 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-muted">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              void load({ page: nextPage });
            }}
            className="rounded-full border border-line px-4 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
