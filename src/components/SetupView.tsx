"use client";

import { useState, type ReactNode } from "react";
import type { AppStatus } from "@/lib/types";

const AUTH_COMMAND = "npm run auth:netflix";
const NETFLIX_ACTIVITY = "https://www.netflix.com/WiViewingActivity";
const NETFLIX_HELP = "https://help.netflix.com/en/node/101917";
const AMAZON_DATA_REQUEST =
  "https://www.amazon.com/hz/privacy-central/data-requests/preview.html";
const TMDB_API = "https://www.themoviedb.org/settings/api";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent-2 underline decoration-accent-2/40 underline-offset-2 hover:decoration-accent-2"
    >
      {children}
    </a>
  );
}

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
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-display text-2xl">1. Netflix watch history</h2>
        <p className="mt-3 text-sm text-muted">
          Import the official Viewing activity CSV. Netflix&apos;s steps:{" "}
          <ExternalLink href={NETFLIX_HELP}>viewing history help</ExternalLink>.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            In a terminal run <code className="text-accent-2">{AUTH_COMMAND}</code>
            {status.netflixAuth.present
              ? " — a saved session is present."
              : " — no saved session yet."}{" "}
            Prefer email and password; Google sign-in often fails in Chromium.
          </li>
          <li>Pick the profile you want tracked, then finish login and 2FA.</li>
          <li>
            Click <span className="text-foreground">Refresh watch history</span>.
            The app opens{" "}
            <ExternalLink href={NETFLIX_ACTIVITY}>Viewing activity</ExternalLink>{" "}
            and clicks official <span className="text-foreground">Download all</span>.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          Or download it yourself: open{" "}
          <ExternalLink href={NETFLIX_ACTIVITY}>Viewing activity</ExternalLink>,
          scroll to <span className="text-foreground">Download all</span>, then
          upload the CSV below.
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
        </div>
        <label className="mt-6 block">
          <span className="text-sm text-muted">Upload a Netflix CSV</span>
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
        <h2 className="font-display text-2xl">2. Prime Video watch history</h2>
        <p className="mt-3 text-sm text-muted">
          Amazon does not offer an instant CSV. Request an official privacy ZIP
          (often a few days; Amazon may say up to 30).
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Sign in and open{" "}
            <ExternalLink href={AMAZON_DATA_REQUEST}>Request your data</ExternalLink>
            . Or: Account &amp; Lists → Your Account → Request your data.
          </li>
          <li>
            Request <span className="text-foreground">Prime Video</span> data and
            confirm the email.
          </li>
          <li>Download the ZIP when Amazon says it is ready.</li>
          <li>
            Upload the ZIP here. The app reads{" "}
            <code className="text-accent-2">
              Your Prime Video Viewing Activity/Viewing History.csv
            </code>
            .
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          Use <code className="text-accent-2">Viewing History.csv</code> only.
          Skip Watch Events, Purchases and Rentals, and Promotional Trailers.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
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
            Upload the Prime Video ZIP or Viewing History.csv
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

      <section className="rounded-2xl border border-line bg-paper p-6 lg:col-span-2">
        <h2 className="font-display text-2xl">3. Refresh US catalogs</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Get a free key from{" "}
            <ExternalLink href={TMDB_API}>TMDB API settings</ExternalLink>, paste
            it below, and save. A v3 key or v4 token works.
          </li>
          <li>Select the services you subscribe to.</li>
          <li>
            Click <span className="text-foreground">Refresh selected</span>.
            Metascores are a later OMDb pass on movies you already have.
          </li>
        </ol>
        <label className="mt-5 block max-w-md">
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
        <fieldset className="mt-5 space-y-2">
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
        <p className="mt-3 text-sm text-muted">
          Disney+ and HBO Max are catalogs only. They have no official
          watch-history export, so Unseen Movies subtracts Netflix and Prime watches
          (and titles you mark). A movie you only watched on Disney+ or Max can
          still show as unseen.
        </p>
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
