import { ensureProjectHistoryImported } from "@/lib/project-csv";
import { getAppStatus } from "@/lib/status";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  await ensureProjectHistoryImported();
  return Response.json(getAppStatus());
}
