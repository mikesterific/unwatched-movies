import { rematchAgainstCatalog } from "@/lib/history";

export const runtime = "nodejs";

export function POST() {
  const result = rematchAgainstCatalog();
  return Response.json({ ok: true, ...result });
}
