"use client";

import { useState } from "react";
import type { AppStatus } from "@/lib/types";

const AUTH_COMMAND = "npm run auth:netflix";

function formatWhen(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString();
}

export function SetupView({ initialStatus }: { initialStatus: AppStatus }) {
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "catalog" | "upload" | "auth" | "history" | "ratings" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [selected, setSelected] = useState<string[]>(
    initialStatus.services.map((service) => service.slug),
  );

  async function loadStatus() {
    const response = await fetch("/api/status");
    const data = (await response.json()) as AppStatus;
    setStatus(data);
  }

  function toggleService(slug: string) {
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
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
    setMessage(`Loaded ${data.movieCount} sample Netflix movies so you can try the app without TMDB.`);
    await loadStatus();
  }

  async function refreshSelected() {
    if (selected.length === 0) {
      setError("Select at least one service to refresh.");
      return;
    }
    setBusy("catalog");
    setError(null);
    setMessage(null);
    const summaries: string[] = [];
    for (const slug of selected) {
      const response = await fetch("/api/catalog/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: [slug] }),
      });
      const data = (await response.json()) as {
        error?: string;
        movieCount?: number;
        slug?: string;
      };
      if (!response.ok) {
        setBusy(null);
        setError(data.error ?? `Catalog refresh failed for ${slug}.`);
        await loadStatus();
        return;
      }
      summaries.push(`${data.slug ?? slug}: ${data.movieCount ?? 0}`);
    }
    setBusy(null);
    setMessage(`Cached ${summaries.join(" · ")}.`);
    await loadStatus();
  }

  async function fetchMetascores() {
    setBusy("ratings");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/catalog/ratings", { method: "POST" });
    const data = (await response.json()) as {
      error?: string;
      fetched?: number;
      rated?: number;
    };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Could not fetch Metascores.");
      return;
    }
    setMessage(
      `Looked up ${data.fetched ?? 0} titles in OMDb. ${data.rated ?? 0} have a Metascore.`,
    );
    await loadStatus();
  }

  async function refreshWatchHistory() {
    setBusy("history");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/history/refresh", { method: "POST" });
    const data = (await response.json()) as {
      error?: string;
      movieRowCount?: number;
      droppedRowCount?: number;
      matched?: number;
      review?: number;
    };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Watch history refresh failed.");
      return;
    }
    setMessage(
      `Imported ${data.movieRowCount} movie titles from the official Download all CSV. Matched ${data.matched}, ${data.review} need review.`,
    );
    await loadStatus();
  }

  async function copyAuthCommand() {
    try {
      await navigator.clipboard.writeText(AUTH_COMMAND);
      setMessage(`Copied ${AUTH_COMMAND}. Run it in a terminal, finish Netflix sign-in, then refresh watch history.`);
    } catch {
      setMessage(`Run ${AUTH_COMMAND} in a terminal, finish Netflix sign-in, then refresh watch history.`);
    }
  }

  async function loadProjectCsv() {
    setBusy("upload");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/history/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "netflix" }),
    });
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

  async function loadProjectPrime() {
    setBusy("upload");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/history/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "prime" }),
    });
    const data = (await response.json()) as {
      error?: string;
      movieRowCount?: number;
      droppedRowCount?: number;
      matched?: number;
      review?: number;
    };
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Could not load Prime Video history.");
      return;
    }
    setMessage(
      `Loaded ${data.movieRowCount} Prime movie titles. ${data.review} need review.`,
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
        <h2 className="font-display text-2xl">1. Refresh watch history</h2>
        <p className="mt-3 text-sm text-muted">
          Sign in once in headed Chrome, then this app clicks the official Viewing
          activity <span className="text-foreground">Download all</span> button
          and imports the CSV. It does not use hidden Netflix endpoints.
        </p>
        <p className="mt-3 text-sm text-muted">
          Prime Video uses Amazon&apos;s official privacy ZIP. Import{" "}
          <code className="text-accent-2">Viewing History.csv</code> from that
          archive, or the ZIP itself. Watches merge into the same seen list.
        </p>
        <p className="mt-3 text-sm text-muted">
          One-time login:{" "}
          <code className="text-accent-2">{AUTH_COMMAND}</code>
          {status.netflixAuth.present
            ? " — a saved session is present."
            : " — no saved session yet."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void copyAuthCommand()}
            disabled={busy !== null}
            className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Copy sign-in command
          </button>
          <button
            type="button"
            onClick={() => void refreshWatchHistory()}
            disabled={busy !== null}
            className="rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {busy === "history" ? "Refreshing history…" : "Refresh watch history"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {status.projectCsv.present && (
            <button
              type="button"
              onClick={() => void loadProjectCsv()}
              disabled={busy !== null}
              className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {busy === "upload" ? "Loading project CSV…" : `Load ${status.projectCsv.filename}`}
            </button>
          )}
          {status.projectPrime.present && (
            <button
              type="button"
              onClick={() => void loadProjectPrime()}
              disabled={busy !== null}
              className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {busy === "upload"
                ? "Loading Prime history…"
                : `Load ${status.projectPrime.filename}`}
            </button>
          )}
        </div>

        <label className="mt-6 block">
          <span className="text-sm text-muted">
            Or upload a Netflix CSV or Prime Video ZIP
          </span>
          <input
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
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
        <h2 className="font-display text-2xl">2. Refresh US catalogs</h2>
        <p className="mt-3 text-sm text-muted">
          Pulls movies listed on each selected service from TMDB / JustWatch and
          stores them locally. Metascores are a separate OMDb pass on the movies
          you already have — you do not need to refresh TMDB again to get ratings.
        </p>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm text-muted">Services</legend>
          {status.services.map((service) => (
            <label key={service.slug} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(service.slug)}
                onChange={() => toggleService(service.slug)}
                disabled={busy !== null}
              />
              <span>{service.name}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refreshSelected()}
            disabled={busy !== null}
            className="rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {busy === "catalog" ? "Refreshing catalogs…" : "Refresh selected"}
          </button>
          <button
            type="button"
            onClick={() => void loadSample()}
            disabled={busy !== null}
            className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Load sample catalog
          </button>
          <button
            type="button"
            onClick={() => void fetchMetascores()}
            disabled={busy !== null || !status.omdbConfigured}
            className="rounded-full border border-line px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {busy === "ratings" ? "Fetching Metascores…" : "Fetch Metascores"}
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
            No TMDB key yet. Save one here before refreshing the live catalogs.
          </p>
        )}
        {status.omdbConfigured ? (
          <p className="mt-2 text-sm text-accent-2">
            OMDb key found. Use Fetch Metascores on the cached catalog. Titles
            with fewer than 100 IMDb votes stay unrated.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Optional: add <code className="text-accent-2">OMDB_API_KEY</code> to{" "}
            <code>.env</code> for Metacritic scores.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-6 lg:col-span-2">
        <h2 className="font-display text-2xl">Status</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {status.services.map((service) => (
            <StatusCard
              key={service.slug}
              label={service.name}
              value={service.refreshed_at ? `${service.movie_count} movies` : "Empty"}
              detail={formatWhen(service.refreshed_at)}
            />
          ))}
          <StatusCard
            label="History"
            value={status.history ? `${status.history.movie_row_count} movies` : "None"}
            detail={
              status.history?.source_filename ??
              (status.projectCsv.present || status.projectPrime.present
                ? `${[status.projectCsv.present ? status.projectCsv.filename : null, status.projectPrime.present ? status.projectPrime.filename : null].filter(Boolean).join(" · ")} is in the project`
                : "Refresh or upload a CSV or ZIP")
            }
          />
          <StatusCard
            label="Unseen"
            value={String(status.unseenCount ?? 0)}
            detail={`${status.reviewCount ?? 0} titles need review`}
          />
          <StatusCard
            label="Matched / ignored"
            value={`${status.matchedCount ?? 0} / ${status.ignoredCount ?? 0}`}
            detail="Cached so re-uploads stay fast"
          />
          <StatusCard
            label="Netflix session"
            value={status.netflixAuth.present ? "Saved" : "Missing"}
            detail={status.netflixAuth.present ? ".auth/netflix.json" : AUTH_COMMAND}
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
