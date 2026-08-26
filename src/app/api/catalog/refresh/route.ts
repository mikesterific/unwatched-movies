import { refreshCatalog } from "@/lib/catalog";
import { getTmdbApiKey } from "@/lib/tmdb";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  if (!getTmdbApiKey()) {
    return Response.json(
      { error: "TMDB_API_KEY is not set. Add it to auth.json or paste it on Setup." },
      { status: 400 },
    );
  }

  try {
    const result = await refreshCatalog();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog refresh failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
