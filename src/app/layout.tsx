import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo_Black, IBM_Plex_Mono, DM_Sans, Geist } from "next/font/google";

import { auth } from "@/auth";
import { AppChrome } from "@/components/app-chrome";
import { Providers } from "@/components/providers";
import "./globals.css";
import { adminEmails } from "@/lib/env";
import { isStreamerbotLivestreamActive } from "@/lib/streamerbot/live-status";
import { isThemeMode, themeCookieKey, themeStorageKey } from "@/lib/theme";
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
  title: "Pipetz",
  description: "Ganhe pipetz na live, resgate recompensas, aposte em desafios e sugira jogos.",
};

const themeScript = `
(() => {
  const storageKey = "${themeStorageKey}";
  const cookieKey = "${themeCookieKey}";
  const root = document.documentElement;
  const cookieMatch = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(cookieKey + "="));
  const cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch.split("=").slice(1).join("=")) : null;
  const storedTheme = window.localStorage.getItem(storageKey) ?? cookieTheme;
  const theme =
    storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
`;

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
  const isAdmin = Boolean(session?.user?.email && adminEmails.has(session.user.email.toLowerCase()));

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-theme={initialTheme ?? undefined}
      className={cn("h-full", "antialiased", display.variable, body.variable, mono.variable, "font-sans", geist.variable)}
      style={initialTheme ? { colorScheme: initialTheme } : undefined}
    >
      <body className="min-h-full text-[var(--color-ink)]" style={{ fontFamily: "var(--font-body), var(--font-display), sans-serif" }}>
        <script id="pipetz-theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <AppChrome
            session={session}
            isAdmin={isAdmin}
            isLive={isLive}
            initialTheme={initialTheme}
          >
            {children}
          </AppChrome>
        </Providers>
      </body>
    </html>
  );
}
