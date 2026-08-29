import JSZip from "jszip";
import Papa from "papaparse";
import {
  getField,
  isTvShapedTitle,
  MIN_WATCH_SECONDS,
  type CsvRecord,
  type DropReason,
  type ParsedMovie,
  type ParseNetflixCsvResult,
} from "@/lib/csv";

const KEEP_MATERIALS = new Set(["FULL", "FEATURE"]);
const CLIP_MATERIALS = new Set([
  "PROMO",
  "TRAILER",
  "LIVE",
  "VIDEOADS",
  "EXTERNAL",
]);

export type ParsePrimeCsvResult = ParseNetflixCsvResult;

export function isPrimeViewingHistoryCsv(text: string): boolean {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  return (
    /material type description/i.test(header) && /seconds viewed/i.test(header)
  );
}

export function unquoteAmazonValue(value: string): string {
  let current = value.trim();
  while (
    current.length >= 2 &&
    current.startsWith('"') &&
    current.endsWith('"')
  ) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

function primeField(row: CsvRecord, ...names: string[]): string {
  return unquoteAmazonValue(getField(row, ...names));
}

function parseSecondsViewed(value: string): number | null {
  if (!value || /^not available$/i.test(value)) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

export function classifyPrimeRow(input: {
  title: string;
  materialType?: string;
  entitlement?: string;
  secondsViewed?: number | null;
}): DropReason | null {
  const title = input.title.trim();
  if (!title) {
    return "empty";
  }

  const material = (input.materialType ?? "").trim().toUpperCase();
  const entitlement = (input.entitlement ?? "").trim().toUpperCase();
  if (
    CLIP_MATERIALS.has(material) ||
    entitlement === "TRAILER" ||
    (material && !KEEP_MATERIALS.has(material))
  ) {
    return "clip";
  }
  if (isTvShapedTitle(title)) {
    return "tv";
  }
  if (
    input.secondsViewed != null &&
    input.secondsViewed < MIN_WATCH_SECONDS
  ) {
    return "short";
  }
  return null;
}

export function parsePrimeCsv(text: string): ParsePrimeCsvResult {
  const parsed = Papa.parse<CsvRecord>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  const moviesByTitle = new Map<string, ParsedMovie>();
  const dropped: ParsePrimeCsvResult["dropped"] = [];

  for (const row of parsed.data) {
    const title = primeField(row, "title");
    const materialType = primeField(row, "material type description");
    const entitlement = primeField(row, "entitlement type code");
    const secondsViewed = parseSecondsViewed(primeField(row, "seconds viewed"));
    const watchedAt =
      primeField(row, "playback start datetime (utc)", "playback start datetime") ||
      null;
    const reason = classifyPrimeRow({
      title,
      materialType,
      entitlement,
      secondsViewed,
    });

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
      if (
        secondsViewed != null &&
        (existing.durationSeconds == null ||
          secondsViewed > existing.durationSeconds)
      ) {
        existing.durationSeconds = secondsViewed;
      }
      continue;
    }

    moviesByTitle.set(title, {
      rawTitle: title,
      watchedAt,
      durationSeconds: secondsViewed,
      playCount: 1,
    });
  }

  return {
    movies: [...moviesByTitle.values()],
    dropped,
    totalRows: parsed.data.length,
  };
}

export async function extractPrimeViewingHistory(
  bytes: Uint8Array,
): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  const match = files.find((file) =>
    /(?:^|\/)viewing history\.csv$/i.test(file.name),
  );
  if (!match) {
    throw new Error(
      "Could not find Viewing History.csv in the Prime Video ZIP.",
    );
  }
  return match.async("string");
}
