import fs from "node:fs";
import path from "node:path";
import { getHistoryMeta } from "@/lib/db";
import { importViewingCsv } from "@/lib/history";

export const PROJECT_HISTORY_FILENAME = "NetflixViewingHistory.csv";

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

export async function importProjectHistory() {
  const info = projectHistoryInfo();
  if (!info.present) {
    throw new Error(`${PROJECT_HISTORY_FILENAME} is not in the project folder.`);
  }
  const text = fs.readFileSync(info.path, "utf8");
  return importViewingCsv(text, info.filename);
}

export async function ensureProjectHistoryImported() {
  const info = projectHistoryInfo();
  if (!info.present) {
    return { imported: false, info };
  }

  const history = getHistoryMeta();
  if (history?.source_filename === info.filename) {
    return { imported: false, info };
  }

  const summary = await importProjectHistory();
  return { imported: true, info, summary };
}
