import fs from "node:fs";
import path from "node:path";
import { getHistoryMeta } from "@/lib/db";
import { importHistoryFile, importViewingCsv } from "@/lib/history";

export const PROJECT_HISTORY_FILENAME = "NetflixViewingHistory.csv";
export const PROJECT_PRIME_CSV = "PrimeVideoViewingHistory.csv";
export const PROJECT_PRIME_ZIP = "Prime Video.zip";

export function projectHistoryPath() {
  return (
    process.env.PROJECT_HISTORY_CSV ??
    path.join(process.cwd(), PROJECT_HISTORY_FILENAME)
  );
}

export function projectHistoryInfo() {
  const filePath = projectHistoryPath();
  if (!fs.existsSync(filePath)) {
    return { present: false, filename: PROJECT_HISTORY_FILENAME, path: filePath };
  }
  const stats = fs.statSync(filePath);
  return {
    present: true,
    filename: path.basename(filePath),
    path: filePath,
    bytes: stats.size,
    mtime: stats.mtime.toISOString(),
  };
}

function primeHistoryCandidates(): string[] {
  if (process.env.PROJECT_PRIME_HISTORY) {
    return [process.env.PROJECT_PRIME_HISTORY];
  }
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "uploads", PROJECT_PRIME_CSV),
    path.join(cwd, "data", "uploads", PROJECT_PRIME_ZIP),
    path.join(cwd, PROJECT_PRIME_CSV),
    path.join(cwd, PROJECT_PRIME_ZIP),
  ];
}

export function projectPrimeHistoryInfo() {
  for (const filePath of primeHistoryCandidates()) {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return {
        present: true,
        filename: path.basename(filePath),
        path: filePath,
        bytes: stats.size,
        mtime: stats.mtime.toISOString(),
      };
    }
  }
  return {
    present: false,
    filename: PROJECT_PRIME_CSV,
    path: primeHistoryCandidates()[0] ?? path.join(process.cwd(), PROJECT_PRIME_CSV),
  };
}

export async function importProjectHistory() {
  const info = projectHistoryInfo();
  if (!info.present) {
    throw new Error(`${PROJECT_HISTORY_FILENAME} is not in the project folder.`);
  }
  const text = fs.readFileSync(info.path, "utf8");
  return importViewingCsv(text, info.filename);
}

export async function importProjectPrimeHistory() {
  const info = projectPrimeHistoryInfo();
  if (!info.present) {
    throw new Error("Prime Video viewing history is not in data/uploads.");
  }
  const bytes = fs.readFileSync(info.path);
  return importHistoryFile({ filename: info.filename, bytes });
}

export async function ensureProjectHistoryImported() {
  const info = projectHistoryInfo();
  if (!info.present) {
    return { imported: false, info };
  }

  const history = getHistoryMeta();
  if (history?.source_filename?.split(",").some((part) => part.trim() === info.filename)) {
    return { imported: false, info };
  }

  const summary = await importProjectHistory();
  return { imported: true, info, summary };
}
