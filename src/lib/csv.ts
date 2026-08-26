import Papa from "papaparse";

const TV_PATTERNS = [
  /:\s*season\s+\d+/i,
  /:\s*episode\s+\d+/i,
  /\bseason\s+\d+\s*:\s*episode\s+\d+/i,
  /:\s*limited series\b/i,
  /:\s*series\s+\d+/i,
];

const CLIP_TYPES = new Set([
  "HOOK",
  "TRAILER",
  "TEASER",
  "RECAP",
  "PROMOTIONAL",
  "PREVIEW",
  "SUPPLEMENTAL",
  "BEHIND THE SCENES",
  "FEATURETTE",
]);

const MIN_WATCH_SECONDS = 120;

export type DropReason = "empty" | "tv" | "clip" | "short";

export type ViewingRow = {
  rawTitle: string;
  watchedAt: string | null;
  durationSeconds: number | null;
};

export type ParsedMovie = ViewingRow & {
  playCount: number;
};

export type ParseNetflixCsvResult = {
  movies: ParsedMovie[];
  dropped: { title: string; reason: DropReason }[];
  totalRows: number;
};

type CsvRecord = Record<string, string>;

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function getField(row: CsvRecord, ...names: string[]): string {
  for (const name of names) {
    const match = Object.entries(row).find(
      ([key]) => normalizeHeader(key) === name,
    );
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return "";
}

export function isTvShapedTitle(title: string): boolean {
  return TV_PATTERNS.some((pattern) => pattern.test(title));
}

export function isClipType(supplementalType: string): boolean {
  return CLIP_TYPES.has(supplementalType.trim().toUpperCase());
}

export function parseDurationSeconds(duration: string): number | null {
  const parts = duration.trim().split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

export function classifyViewingRow(input: {
  title: string;
  supplementalType?: string;
  duration?: string;
}): DropReason | null {
  const title = input.title.trim();
  if (!title) {
    return "empty";
  }
  if (input.supplementalType && isClipType(input.supplementalType)) {
    return "clip";
  }
  if (isTvShapedTitle(title)) {
    return "tv";
  }
  if (input.duration) {
    const seconds = parseDurationSeconds(input.duration);
    if (seconds !== null && seconds < MIN_WATCH_SECONDS) {
      return "short";
    }
  }
  return null;
}

export function parseNetflixCsv(text: string): ParseNetflixCsvResult {
  const parsed = Papa.parse<CsvRecord>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  const moviesByTitle = new Map<string, ParsedMovie>();
  const dropped: ParseNetflixCsvResult["dropped"] = [];

  for (const row of parsed.data) {
    const title = getField(row, "title");
    const supplementalType = getField(row, "supplemental video type");
    const duration = getField(row, "duration");
    const watchedAt = getField(row, "date", "start time") || null;
    const reason = classifyViewingRow({ title, supplementalType, duration });

    if (reason) {
      dropped.push({ title, reason });
      continue;
    }

    const existing = moviesByTitle.get(title);
    if (existing) {
      existing.playCount += 1;
      if (watchedAt && (!existing.watchedAt || watchedAt > existing.watchedAt)) {
        existing.watchedAt = watchedAt;
      }
      continue;
    }

    moviesByTitle.set(title, {
      rawTitle: title,
      watchedAt,
      durationSeconds: duration ? parseDurationSeconds(duration) : null,
      playCount: 1,
    });
  }

  return {
    movies: [...moviesByTitle.values()],
    dropped,
    totalRows: parsed.data.length,
  };
}
