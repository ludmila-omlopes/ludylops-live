import type { Metadata } from "next";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { BuilderChrome } from "@/components/builder-chrome";
import { hubMono } from "@/components/hub-home/fonts";
import { Providers } from "@/components/providers";
import { adminEmails, isDemoMode, platformOwnerEmails } from "@/lib/env";
import { isThemeMode, themeCookieKey } from "@/lib/theme";
import { PLATFORM_NAME } from "@/lib/creators/platform";

import "./hub-theme.css";

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "Compartilhe suas indicações com a sua comunidade.",
};

export default async function BuilderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(themeCookieKey)?.value;
  const initialTheme = isThemeMode(cookieTheme) ? cookieTheme : null;
  const session = await auth();
  const isPlatformOwner = Boolean(
    session?.user?.email &&
      (isDemoMode || platformOwnerEmails.has(session.user.email.toLowerCase())),
  );

  return (
    <Providers>
      <BuilderChrome
        initialTheme={initialTheme}
        fontClassName={hubMono.variable}
        isPlatformOwner={isPlatformOwner}
        isAdmin={Boolean(session?.user?.email && (isDemoMode || adminEmails.has(session.user.email.toLowerCase())))}
        isSignedIn={Boolean(session?.user?.email && session.user.activeViewerId)}
      >
        {children}
      </BuilderChrome>
    </Providers>
  );
}
