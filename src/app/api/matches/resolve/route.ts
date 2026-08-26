import { resolveMatch } from "@/lib/history";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id?: number;
    action?: "match" | "ignore";
    tmdbId?: number;
  };

  if (!body.id || (body.action !== "match" && body.action !== "ignore")) {
    return Response.json({ error: "Provide id and action (match or ignore)." }, { status: 400 });
  }

  try {
    resolveMatch({ id: body.id, action: body.action, tmdbId: body.tmdbId });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve match.";
    return Response.json({ error: message }, { status: 400 });
  }
}
