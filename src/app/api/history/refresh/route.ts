import { refreshOfficialHistory } from "@/lib/netflix-history-download";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await refreshOfficialHistory();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Watch history refresh failed.";
    const status = /session|auth:netflix|profile|Download all/i.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
