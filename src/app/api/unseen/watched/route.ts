import { markCatalogMovieWatched } from "@/lib/history";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { tmdbId?: number };

  if (!body.tmdbId || !Number.isInteger(body.tmdbId)) {
    return Response.json({ error: "Provide a TMDB id." }, { status: 400 });
  }

  try {
    const result = markCatalogMovieWatched(body.tmdbId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark that movie as watched.";
    return Response.json({ error: message }, { status: 400 });
  }
}
