"use client";

import Image from "next/image";
import { useState } from "react";

type Candidate = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterUrl: string | null;
};

type ReviewItem = {
  id: number;
  rawTitle: string;
  lastWatchedAt: string | null;
  candidates: Candidate[];
};

export function ReviewView({ initialItems }: { initialItems: ReviewItem[] }) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/matches");
    const data = (await response.json()) as { items: ReviewItem[] };
    setItems(data.items);
  }

  async function resolve(id: number, action: "match" | "ignore", tmdbId?: number) {
    setError(null);
    const response = await fetch("/api/matches/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, tmdbId }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not save that decision.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function retry() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/history/retry", { method: "POST" });
    const data = (await response.json()) as {
      error?: string;
      searched?: number;
      matched?: number;
    };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Retry failed.");
      return;
    }
    setMessage(`Re-searched ${data.searched} titles, auto-matched ${data.matched}.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">Review leftover titles</h2>
          <p className="text-sm text-muted">
            Netflix CSV titles have no IDs. Confirm the movie or mark it as not
            a movie so the unseen list stays honest.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Searching…" : "Retry TMDB search"}
        </button>
      </div>

      {message && <p className="text-sm text-accent-2">{message}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-muted">
          No titles waiting for review. Upload a CSV on Setup if this is your
          first run.
        </p>
      ) : (
        <ul className="space-y-5">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl">{item.rawTitle}</h3>
                  {item.lastWatchedAt && (
                    <p className="text-xs text-muted">Last seen {item.lastWatchedAt}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void resolve(item.id, "ignore")}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-foreground"
                >
                  Not a movie
                </button>
              </div>

              {item.candidates.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  No TMDB movie candidates. Mark it as not a movie, or retry
                  search after setting <code>TMDB_API_KEY</code>.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {item.candidates.map((candidate) => (
                    <li key={candidate.tmdbId}>
                      <button
                        type="button"
                        onClick={() => void resolve(item.id, "match", candidate.tmdbId)}
                        className="flex w-full gap-3 rounded-xl bg-paper-2 p-3 text-left hover:bg-line/40"
                      >
                        {candidate.posterUrl ? (
                          <Image
                            src={candidate.posterUrl}
                            alt=""
                            width={48}
                            height={64}
                            className="h-16 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-16 w-12 rounded bg-background" />
                        )}
                        <span>
                          <span className="block text-sm">{candidate.title}</span>
                          <span className="text-xs text-muted">
                            {candidate.releaseYear ?? "Year unknown"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
