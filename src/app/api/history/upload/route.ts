import { importHistoryFile } from "@/lib/history";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Upload a Netflix CSV or Prime Video ZIP." },
      { status: 400 },
    );
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".zip")) {
    return Response.json(
      { error: "The upload must be a .csv or .zip file." },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const summary = await importHistoryFile({ filename: file.name, bytes });
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "History import failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
