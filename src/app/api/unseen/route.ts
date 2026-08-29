import type { UnseenSort } from "@/lib/types";
import { queryUnseen } from "@/lib/unseen";

export const runtime = "nodejs";

function numberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function providersParam(value: string | null): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function hideWatchedParam(value: string | null): boolean {
  if (!value) {
    return true;
  }
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") as UnseenSort | null;
  const order = url.searchParams.get("order");

  const result = queryUnseen({
    q: url.searchParams.get("q") ?? undefined,
    genre: numberParam(url.searchParams.get("genre")),
    yearMin: numberParam(url.searchParams.get("yearMin")),
    yearMax: numberParam(url.searchParams.get("yearMax")),
    ratingMin: numberParam(url.searchParams.get("ratingMin")),
    providers: providersParam(url.searchParams.get("providers")),
    hideWatched: hideWatchedParam(url.searchParams.get("hideWatched")),
    sort: sort ?? undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
    page: numberParam(url.searchParams.get("page")),
    pageSize: numberParam(url.searchParams.get("pageSize")),
  });

  return Response.json(result);
}
