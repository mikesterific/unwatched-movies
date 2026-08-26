import { loadSampleCatalog } from "@/lib/sample-catalog";

export const runtime = "nodejs";

export function POST() {
  const result = loadSampleCatalog();
  return Response.json({ ok: true, ...result, sample: true });
}
