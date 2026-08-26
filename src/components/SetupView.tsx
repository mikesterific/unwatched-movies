"use client";

import { useState } from "react";
import type { AppStatus } from "@/lib/types";

function formatWhen(value: string | undefined) {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString();
}

export function SetupView({ initialStatus }: { initialStatus: AppStatus }) {
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"catalog" | "upload" | "auth" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tmdbApiKey, setTmdbApiKey] = useState("");

  async function loadStatus() {
    const response = await fetch("/api/status");
    const data = (await response.json()) as AppStatus;
    setStatus(data);
  }

  async function saveAuthKey() {
    setBusy("auth");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbApiKey }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Could not save auth.json.");
      return;
    }
    setTmdbApiKey("");
    setMessage("Saved TMDB key to local auth.json.");
    await loadStatus();
  }

  async function loadSample() {
    setBusy("catalog");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/catalog/sample", { method: "POST" });
    const data = (await response.json()) as { error?: string; movieCount?: number };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Could not load the sample catalog.");
      return;
    }
    setMessage(`Loaded ${data.movieCount} sample movies so you can try the app without TMDB.`);
    await loadStatus();
  }

  async function refreshCatalog() {
    setBusy("catalog");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/catalog/refresh", { method: "POST" });
    const data = (await response.json()) as { error?: string; movieCount?: number };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Catalog refresh failed.");
      return;
    }
    setMessage(`Cached ${data.movieCount} US Netflix movies.`);
    await loadStatus();
  }

  async function loadProjectCsv() {
    setBusy("upload");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/history/project", { method: "POST" });
    const data = (await response.json()) as {
      error?: string;
      movieRowCount?: number;
      droppedRowCount?: number;
      matched?: number;
      review?: number;
    };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Could not load the project CSV.");
      return;
    }
    setMessage(
      `Loaded ${data.movieRowCount} movie titles from the project CSV. ${data.review} need review.`,
    );
    await loadStatus();
  }

  async function uploadHistory(file: File) {
    setBusy("upload");
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/history/upload", { method: "POST", body });
    const data = (await response.json()) as {
      error?: string;
      movieRowCount?: number;
      droppedRowCount?: number;
      matched?: number;
      review?: number;
    };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    setMessage(
      `Imported ${data.movieRowCount} movie titles, dropped ${data.droppedRowCount} TV/clip/short rows. Matched ${data.matched}, ${data.review} need review.`,
    );
    await loadStatus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-display text-2xl">1. Download your official history</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
          <li>On a computer, open Netflix and go to Account.</li>
          <li>Choose your profile, then Viewing activity.</li>
          <li>Scroll to the bottom and click Download all.</li>
        </ol>
        <p className="mt-4 text-sm text-muted">
          Keep <code className="text-accent-2">NetflixViewingHistory.csv</code>{" "}
          in this repo and copy the folder (or commit the CSV) to run the same
          history somewhere else. You only need a new export when you want newer
          watches.
        </p>
        {status.projectCsv.present && (
          <button
            type="button"
            onClick={() => void loadProjectCsv()}
            disabled={busy !== null}
            className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {busy === "upload" ? "Loading project CSV…" : `Load ${status.projectCsv.filename}`}
          </button>
        )}

        <label className="mt-6 block">
          <span className="text-sm text-muted">Upload the CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full rounded-xl border border-line bg-paper-2 px-3 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadHistory(file);
              }
            }}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-display text-2xl">2. Refresh the US catalog</h2>
        <p className="mt-3 text-sm text-muted">
          Pulls movies currently listed on Netflix US from TMDB / JustWatch and
          stores them locally. Re-run this when the catalog changes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            disabled={busy !== null}
            className="rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {busy === "catalog" ? "Refreshing catalog…" : "Refresh catalog"}
          </button>
          <button
            type="button"
            onClick={() => void loadSample()}
            disabled={busy !== null}
            className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Load sample catalog
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm text-muted">TMDB API key</span>
          <input
            type="password"
            autoComplete="off"
            value={tmdbApiKey}
            onChange={(event) => setTmdbApiKey(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper-2 px-3 py-3 text-sm"
            placeholder="Paste a v3 key or v4 token"
            disabled={busy !== null}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveAuthKey()}
          disabled={busy !== null || !tmdbApiKey.trim()}
          className="mt-3 rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {busy === "auth" ? "Saving…" : "Save to auth.json"}
        </button>
        <p className="mt-3 text-sm text-muted">
          Keys stay in local <code className="text-accent-2">auth.json</code>{" "}
          (gitignored). You can also copy <code>auth.example.json</code> and
          edit the file directly.
        </p>
        {status.tmdbConfigured ? (
          <p className="mt-2 text-sm text-accent-2">A TMDB key is configured.</p>
        ) : (
          <p className="mt-2 text-sm text-accent-2">
            No TMDB key yet. Save one here before refreshing the live catalog.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-6 lg:col-span-2">
        <h2 className="font-display text-2xl">Status</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="Catalog"
            value={status?.catalog ? `${status.catalog.movie_count} movies` : "Empty"}
            detail={formatWhen(status?.catalog?.refreshed_at)}
          />
          <StatusCard
            label="History"
            value={status?.history ? `${status.history.movie_row_count} movies` : "None"}
            detail={
              status.history?.source_filename ??
              (status.projectCsv.present
                ? `${status.projectCsv.filename} is in the project`
                : "Upload a CSV")
            }
          />
          <StatusCard
            label="Unseen"
            value={String(status?.unseenCount ?? 0)}
            detail={`${status?.reviewCount ?? 0} titles need review`}
          />
          <StatusCard
            label="Matched / ignored"
            value={`${status?.matchedCount ?? 0} / ${status?.ignoredCount ?? 0}`}
            detail="Cached so re-uploads stay fast"
          />
        </dl>
        {message && <p className="mt-4 text-sm text-accent-2">{message}</p>}
        {error && <p className="mt-4 text-sm text-accent">{error}</p>}
      </section>
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl bg-paper-2 px-4 py-3">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-xl">{value}</dd>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
