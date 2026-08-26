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
    sort: sort ?? undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
    page: numberParam(url.searchParams.get("page")),
    pageSize: numberParam(url.searchParams.get("pageSize")),
  });

  return Response.json(result);
}
