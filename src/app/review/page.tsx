import { AppShell } from "@/components/AppShell";
import { ReviewView } from "@/components/ReviewView";
import { listReviewItems } from "@/lib/history";
import { posterUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const items = JSON.parse(
    JSON.stringify(
      listReviewItems().map((item) => ({
        ...item,
        candidates: item.candidates.map((candidate) => ({
          ...candidate,
          posterUrl: posterUrl(candidate.posterPath),
        })),
      })),
    ),
  );

  return (
    <AppShell current="/review">
      <ReviewView initialItems={items} />
    </AppShell>
  );
}
