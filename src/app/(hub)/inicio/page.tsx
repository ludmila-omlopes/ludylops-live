import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HubHome } from "@/components/hub-home/hub-home";
import { COMMUNITIES_PATH } from "@/lib/creators/owner-dashboard";
import { getPlatformOrigin, PLATFORM_NAME } from "@/lib/creators/platform";
import { listCreatorAreasForOwner } from "@/lib/creators/service";
import { isThemeMode, themeCookieKey } from "@/lib/theme";

export const metadata: Metadata = {
  title: { absolute: PLATFORM_NAME },
  description:
    "Um ponto de encontro para a sua comunidade: indicações de jogos, vídeos para react e links de afiliado num só lugar, com a cara do seu canal.",
};

export default async function CreatorHubHomePage() {
  const session = await auth();
  const viewerId = session?.user?.email ? session.user.activeViewerId : null;

  // Owners go straight to their communities, as they did from the platform root before.
  if (viewerId && (await listCreatorAreasForOwner(viewerId, { includeArchived: true })).length > 0) {
    redirect(COMMUNITIES_PATH);
  }

  const cookieTheme = (await cookies()).get(themeCookieKey)?.value;

  return (
    <HubHome
      host={new URL(getPlatformOrigin()).host}
      initialTheme={isThemeMode(cookieTheme) ? cookieTheme : null}
    />
  );
}
