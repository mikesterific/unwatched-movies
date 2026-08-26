import { importProjectHistory } from "@/lib/project-csv";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const summary = await importProjectHistory();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project CSV import failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
