import type { Metadata } from "next";
import { AdminCreatorAreaAccessPanel } from "@/components/admin-creator-area-access-panel";
import { requireAdminSession } from "@/lib/auth/session";
import { getCreatorAreaAccessSettings } from "@/lib/creators/access";

export const metadata: Metadata = { title: "Acesso ao beta" };

export default async function BetaAdminPage() {
  await requireAdminSession();
  const settings = await getCreatorAreaAccessSettings();
  return (
    <div className="hub-page grid max-w-5xl gap-8">
      <h1 className="hub-h1">Acesso ao beta</h1>
      <AdminCreatorAreaAccessPanel initialSettings={settings} />
    </div>
  );
}
