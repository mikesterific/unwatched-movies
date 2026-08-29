import {
  countByStatus,
  countUnseen,
  getCatalogServices,
  getHistoryMeta,
} from "@/lib/db";
import { getOmdbApiKey } from "@/lib/omdb";
import { hasNetflixAuth } from "@/lib/netflix-session";
import { projectHistoryInfo, projectPrimeHistoryInfo } from "@/lib/project-csv";
import { getTmdbApiKey } from "@/lib/tmdb";
import type { AppStatus } from "@/lib/types";

export function getAppStatus(): AppStatus {
  const projectCsv = projectHistoryInfo();
  const projectPrime = projectPrimeHistoryInfo();
  return JSON.parse(
    JSON.stringify({
      tmdbConfigured: Boolean(getTmdbApiKey()),
      omdbConfigured: Boolean(getOmdbApiKey()),
      services: getCatalogServices().map((service) => ({
        slug: service.slug,
        name: service.name,
        refreshed_at: service.refreshed_at,
        movie_count: service.movie_count,
      })),
      history: getHistoryMeta(),
      matchedCount: Number(countByStatus("matched")),
      reviewCount: Number(countByStatus("review")),
      ignoredCount: Number(countByStatus("ignored")),
      unseenCount: Number(countUnseen()),
      projectCsv: {
        present: projectCsv.present,
        filename: projectCsv.filename,
      },
      projectPrime: {
        present: projectPrime.present,
        filename: projectPrime.filename,
      },
      netflixAuth: {
        present: hasNetflixAuth(),
      },
    }),
  ) as AppStatus;
}
