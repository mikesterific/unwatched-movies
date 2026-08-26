import { listReviewItems } from "@/lib/history";
import { posterUrl } from "@/lib/tmdb";

export const runtime = "nodejs";

export function GET() {
  const items = listReviewItems().map((item) => ({
    ...item,
    candidates: item.candidates.map((candidate) => ({
      ...candidate,
      posterUrl: posterUrl(candidate.posterPath),
    })),
  }));
  return Response.json({ items });
}
