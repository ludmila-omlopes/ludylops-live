import { cookies } from "next/headers";
import { Archivo_Black, IBM_Plex_Mono, DM_Sans, Geist } from "next/font/google";

import "./globals.css";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(themeCookieKey)?.value;
  const initialTheme = isThemeMode(cookieTheme) ? cookieTheme : null;

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
        {children}
      </body>
    </html>
  );
}
