import { AppShell } from "@/components/AppShell";
import { UnseenView } from "@/components/UnseenView";
import { queryUnseen } from "@/lib/unseen";

export const dynamic = "force-dynamic";

export default function UnseenPage() {
  return (
    <AppShell current="/unseen">
      <UnseenView initialData={queryUnseen({ page: 1, pageSize: 24, sort: "popularity" })} />
    </AppShell>
  );
}
