import { AUTH_KEY_HELP, writeAuthKeys } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { tmdbApiKey?: string };
  const tmdbApiKey = body.tmdbApiKey?.trim() ?? "";

  if (!tmdbApiKey) {
    return Response.json(
      { error: `A TMDB API key is required. ${AUTH_KEY_HELP}` },
      { status: 400 },
    );
  }

  writeAuthKeys({ tmdbApiKey });
  return Response.json({ ok: true, tmdbConfigured: true });
}
