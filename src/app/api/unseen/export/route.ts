import { exportUnseenCsv } from "@/lib/unseen";

export const runtime = "nodejs";

function hideWatchedParam(value: string | null): boolean {
  if (!value) {
    return true;
  }
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const providers = url.searchParams.get("providers");
  const slugs = providers
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const csv = exportUnseenCsv(
    slugs?.length ? slugs : undefined,
    hideWatchedParam(url.searchParams.get("hideWatched")),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unseen-movies.csv"',
    },
  });
}
