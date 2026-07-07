import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo_Black, IBM_Plex_Mono, DM_Sans, Geist } from "next/font/google";

import { auth } from "@/auth";
import { AppChrome } from "@/components/app-chrome";
import { Providers } from "@/components/providers";
import "./globals.css";
import { adminEmails, isDemoMode, platformOwnerEmails } from "@/lib/env";
import { isStreamerbotLivestreamActive } from "@/lib/streamerbot/live-status";
import { isThemeMode, themeCookieKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const display = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Ludylops Games: eu disseco jogos no YouTube",
  description:
    "Faço lives e vídeos de jogos no YouTube, com campanhas longas, sugestões do chat e muito bate-papo. Acompanhe o jogo atual, junte pipetz e participe do que acontece ao vivo.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(themeCookieKey)?.value;
  const initialTheme = isThemeMode(cookieTheme) ? cookieTheme : null;
  const [session, isLive] = await Promise.all([
    auth(),
    isStreamerbotLivestreamActive(),
  ]);
  const isAdmin = Boolean(
    session?.user?.email && (isDemoMode || adminEmails.has(session.user.email.toLowerCase())),
  );
  const isPlatformOwner = Boolean(
    session?.user?.email &&
      (isDemoMode || platformOwnerEmails.has(session.user.email.toLowerCase())),
  );

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-theme={initialTheme ?? undefined}
      data-scroll-behavior="smooth"
      className={cn("h-full", "antialiased", display.variable, body.variable, mono.variable, "font-sans", geist.variable)}
      style={initialTheme ? { colorScheme: initialTheme } : undefined}
    >
      <body className="min-h-full text-[var(--color-ink)]" style={{ fontFamily: "var(--font-body), var(--font-display), sans-serif" }}>
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
      </body>
    </html>
  );
}
