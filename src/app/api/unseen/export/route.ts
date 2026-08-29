import { exportUnseenCsv } from "@/lib/unseen";

export const runtime = "nodejs";

export function GET(request: Request) {
  const providers = new URL(request.url).searchParams.get("providers");
  const slugs = providers
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const csv = exportUnseenCsv(slugs?.length ? slugs : undefined);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unseen-movies.csv"',
    },
  });
}
