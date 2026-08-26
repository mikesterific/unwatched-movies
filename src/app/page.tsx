import { AppShell } from "@/components/AppShell";
import { SetupView } from "@/components/SetupView";
import { ensureProjectHistoryImported } from "@/lib/project-csv";
import { getAppStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureProjectHistoryImported();
  return (
    <AppShell current="/">
      <SetupView initialStatus={getAppStatus()} />
    </AppShell>
  );
}
