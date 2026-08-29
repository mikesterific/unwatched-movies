import { importProjectHistory, importProjectPrimeHistory } from "@/lib/project-csv";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = body && typeof body === "object" && "source" in body
      ? String((body as { source?: string }).source)
      : "netflix";
    const summary =
      source === "prime"
        ? await importProjectPrimeHistory()
        : await importProjectHistory();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Project history import failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
