import type { Metadata } from "next";
import { AdminCreatorAreaAccessPanel } from "@/components/admin-creator-area-access-panel";
import { requireAdminSession } from "@/lib/auth/session";
import { getCreatorAreaAccessSettings } from "@/lib/creators/access";

export const metadata: Metadata = { title: "Acesso ao beta" };

export default async function BetaAdminPage() {
  await requireAdminSession();
  const settings = await getCreatorAreaAccessSettings();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-4xl uppercase" style={{ fontFamily: "var(--font-display)" }}>Acesso ao beta</h1>
      <AdminCreatorAreaAccessPanel initialSettings={settings} />
    </div>
  );
}
