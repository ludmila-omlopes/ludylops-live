import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePublicCreatorFromRequest } from "@/lib/creators/tenant";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

import { auth } from "@/auth";
import { AppChrome } from "@/components/app-chrome";
import { Providers } from "@/components/providers";
import { adminEmails, isDemoMode, platformOwnerEmails } from "@/lib/env";
import { isStreamerbotLivestreamActive } from "@/lib/streamerbot/live-status";
import { isThemeMode, themeCookieKey } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Ludylops Games: eu disseco jogos no YouTube",
  description:
    "Faço lives e vídeos de jogos no YouTube, com campanhas longas, sugestões do chat e muito bate-papo. Acompanhe o jogo atual, junte pipetz e participe do que acontece ao vivo.",
};

export default async function CommunityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This legacy shell loads global live state and navigation. Scoped modules use /c/:slug instead.
  const tenant = await resolvePublicCreatorFromRequest({ request: new Request("http://internal/", { headers: await headers() }), pathname: "/" });
  if (!tenant || tenant.creator.id !== DEFAULT_CREATOR_ID) notFound();
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(themeCookieKey)?.value;
  const initialTheme = isThemeMode(cookieTheme) ? cookieTheme : null;
  const [session, isLive] = await Promise.all([auth(), isStreamerbotLivestreamActive()]);
  const isAdmin = Boolean(
    session?.user?.email && (isDemoMode || adminEmails.has(session.user.email.toLowerCase())),
  );
  const isPlatformOwner = Boolean(
    session?.user?.email &&
      (isDemoMode || platformOwnerEmails.has(session.user.email.toLowerCase())),
  );

  return (
    <Providers>
      <AppChrome
        session={session}
        isAdmin={isAdmin}
        isPlatformOwner={isPlatformOwner}
        isLive={isLive}
        initialTheme={initialTheme}
        showViewerLinkingAlert={Boolean(session?.user?.email && session.user.isLinked === false)}
      >
        {children}
      </AppChrome>
    </Providers>
  );
}
