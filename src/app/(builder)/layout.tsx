import type { Metadata } from "next";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { BuilderChrome } from "@/components/builder-chrome";
import { Providers } from "@/components/providers";
import { isDemoMode, platformOwnerEmails } from "@/lib/env";
import { isThemeMode, themeCookieKey } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Comunidades",
  description: "Prepare o encontro da sua comunidade com a próxima live.",
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
      <BuilderChrome initialTheme={initialTheme} isPlatformOwner={isPlatformOwner}>
        {children}
      </BuilderChrome>
    </Providers>
  );
}
