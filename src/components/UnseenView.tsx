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
  const [providers, setProviders] = useState<string[]>([]);
  const [hideWatched, setHideWatched] = useState(true);
  const [markingId, setMarkingId] = useState<number | null>(null);

  function providerQuery(nextProviders: string[]) {
    return nextProviders.join(",");
  }

  async function load(next: {
    q?: string;
    genre?: string;
    yearMin?: string;
    ratingMin?: string;
    sort?: UnseenSort;
    page?: number;
    providers?: string[];
    hideWatched?: boolean;
  }) {
    const nextQ = next.q ?? q;
    const nextGenre = next.genre ?? genre;
    const nextYearMin = next.yearMin ?? yearMin;
    const nextRatingMin = next.ratingMin ?? ratingMin;
    const nextSort = next.sort ?? sort;
    const nextPage = next.page ?? page;
    const nextProviders = next.providers ?? providers;
    const nextHideWatched = next.hideWatched ?? hideWatched;
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
    if (nextProviders.length) params.set("providers", providerQuery(nextProviders));
    if (!nextHideWatched) params.set("hideWatched", "0");
    try {
      const response = await fetch(`/api/unseen?${params}`);
      setData((await response.json()) as UnseenPage);
      setError(null);
    } catch {
      setError("Could not load unseen movies.");
    }
  }

  async function markWatched(tmdbId: number) {
    setMarkingId(tmdbId);
    setError(null);
    try {
      const response = await fetch("/api/unseen/watched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not mark that movie as watched.");
        return;
      }
      const lastOnPage = data.items.length === 1 && page > 1;
      const nextPage = lastOnPage ? page - 1 : page;
      if (lastOnPage) {
        setPage(nextPage);
      }
      await load({ page: nextPage });
    } catch {
      setError("Could not mark that movie as watched.");
    } finally {
      setMarkingId(null);
    }
  }

  const exportParams = new URLSearchParams();
  if (providers.length) exportParams.set("providers", providerQuery(providers));
  if (!hideWatched) exportParams.set("hideWatched", "0");
  const exportQuery = exportParams.toString();
  const exportHref = exportQuery
    ? `/api/unseen/export?${exportQuery}`
    : "/api/unseen/export";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">
            {hideWatched ? "Movies you have not watched" : "All movies"}
          </h2>
          <p className="text-sm text-muted">
            {hideWatched
              ? `${data.total} titles on selected US services minus titles you have watched.`
              : `${data.total} titles on selected US services, including titles you have watched.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Watched filter"
            className="flex rounded-full border border-line p-0.5 text-sm"
          >
            <button
              type="button"
              aria-pressed={hideWatched}
              onClick={() => {
                if (hideWatched) {
                  return;
                }
                setHideWatched(true);
                setPage(1);
                void load({ hideWatched: true, page: 1 });
              }}
              className={`rounded-full px-4 py-2 transition-colors ${
                hideWatched
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Unseen
            </button>
            <button
              type="button"
              aria-pressed={!hideWatched}
              onClick={() => {
                if (!hideWatched) {
                  return;
                }
                setHideWatched(false);
                setPage(1);
                void load({ hideWatched: false, page: 1 });
              }}
              className={`rounded-full px-4 py-2 transition-colors ${
                !hideWatched
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              All titles
            </button>
          </div>
          <a
            href={exportHref}
            className="rounded-full border border-line px-4 py-2 text-sm text-accent-2 hover:bg-paper"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-paper p-4 md:grid-cols-6">
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
          <span className="text-muted">Min Metascore</span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={ratingMin}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setRatingMin(value);
              void load({ ratingMin: value, page: 1 });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-3 py-2"
            placeholder="70"
          />
          <span className="mt-1 block text-xs text-muted">
            When set, unrated titles are hidden
          </span>
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
            <option value="rating">Metascore</option>
            <option value="title">Title</option>
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="text-muted">Services</legend>
          <div className="mt-1 space-y-1">
            {data.services.map((service) => (
              <label key={service.slug} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={providers.includes(service.slug)}
                  onChange={() => {
                    const next = providers.includes(service.slug)
                      ? providers.filter((slug) => slug !== service.slug)
                      : [...providers, service.slug];
                    setProviders(next);
                    setPage(1);
                    void load({ providers: next, page: 1 });
                  }}
                />
                <span>{service.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      {data.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-muted">
          Nothing to show yet. Refresh one or more catalogs and import your
          Netflix viewing CSV on Setup.
          {hideWatched
            ? " If catalogs are loaded and this is empty, every current title is marked watched — switch to All titles to see them."
            : null}
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
              <div className="flex min-w-0 flex-1 flex-col">
                <a
                  href={movie.tmdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-lg leading-tight hover:text-accent-2"
                >
                  {movie.title}
                </a>
                <p className="mt-1 text-sm text-muted">
                  {[movie.year, movie.rating != null ? String(movie.rating) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-muted">
                  {movie.genres.join(" / ") || "Uncategorized"}
                </p>
                {(movie.watched || movie.services.length > 0) && (
                  <p className="mt-2 flex flex-wrap gap-1">
                    {movie.watched ? (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] text-accent-2">
                        Watched
                      </span>
                    ) : null}
                    {movie.services.map((service) =>
                      service.watchUrl ? (
                        <a
                          key={service.slug}
                          href={service.watchUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${movie.title} on ${service.name}`}
                          className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-accent-2 hover:bg-line hover:underline"
                        >
                          {service.name}
                        </a>
                      ) : (
                        <span
                          key={service.slug}
                          className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-accent-2"
                        >
                          {service.name}
                        </span>
                      ),
                    )}
                  </p>
                )}
                {movie.watched ? null : (
                  <button
                    type="button"
                    disabled={markingId === movie.tmdbId}
                    onClick={() => void markWatched(movie.tmdbId)}
                    className="mt-3 self-start rounded-full border border-line px-3 py-1.5 text-xs text-accent-2 hover:bg-paper-2 disabled:opacity-50"
                  >
                    {markingId === movie.tmdbId ? "Saving…" : "Mark watched"}
                  </button>
                )}
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
