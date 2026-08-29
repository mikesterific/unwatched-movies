import { enrichCatalogRatings, getOmdbApiKey } from "@/lib/omdb";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST() {
  if (!getOmdbApiKey()) {
    return Response.json(
      { error: "OMDB_API_KEY is not set. Add it to .env and restart the app." },
      { status: 400 },
    );
  }

  try {
    const result = await enrichCatalogRatings();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Metascore fetch failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
