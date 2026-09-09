import type { Metadata } from "next";
import { cookies } from "next/headers";

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
