import { exportUnseenCsv } from "@/lib/unseen";

export const runtime = "nodejs";

export function GET() {
  const csv = exportUnseenCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unseen-netflix-movies.csv"',
    },
  });
}
