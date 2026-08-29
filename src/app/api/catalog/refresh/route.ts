import { refreshCatalog } from "@/lib/catalog";
import { getTmdbApiKey } from "@/lib/tmdb";

export const runtime = "nodejs";
export const maxDuration = 900;

type RefreshBody = {
  providers?: string[];
};

export async function POST(request: Request) {
  if (!getTmdbApiKey()) {
    return Response.json(
      { error: "TMDB_API_KEY is not set. Add it to auth.json or paste it on Setup." },
      { status: 400 },
    );
  }

  let body: RefreshBody = {};
  try {
    body = (await request.json()) as RefreshBody;
  } catch {
    body = {};
  }

  try {
    const result = await refreshCatalog(body.providers);
    const first = result.services[0];
    return Response.json({
      ok: true,
      ...result,
      slug: first?.slug,
      movieCount: first?.movieCount,
      refreshedAt: first?.refreshedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog refresh failed.";
    const status = message.startsWith("Unknown service") ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
