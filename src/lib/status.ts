import {
  countByStatus,
  countUnseen,
  getCatalogMeta,
  getHistoryMeta,
} from "@/lib/db";
import { projectHistoryInfo } from "@/lib/project-csv";
import { getTmdbApiKey } from "@/lib/tmdb";
import type { AppStatus } from "@/lib/types";

export function getAppStatus(): AppStatus {
  const projectCsv = projectHistoryInfo();
  return JSON.parse(
    JSON.stringify({
      tmdbConfigured: Boolean(getTmdbApiKey()),
      catalog: getCatalogMeta(),
      history: getHistoryMeta(),
      matchedCount: Number(countByStatus("matched")),
      reviewCount: Number(countByStatus("review")),
      ignoredCount: Number(countByStatus("ignored")),
      unseenCount: Number(countUnseen()),
      projectCsv: {
        present: projectCsv.present,
        filename: projectCsv.filename,
      },
    }),
  ) as AppStatus;
}
