import { importViewingCsv } from "@/lib/history";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a Netflix viewing-activity CSV." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json({ error: "The upload must be a .csv file." }, { status: 400 });
  }

  try {
    const text = await file.text();
    const summary = await importViewingCsv(text, file.name);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV import failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
