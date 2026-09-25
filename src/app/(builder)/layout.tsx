import type { Metadata } from "next";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { BuilderChrome } from "@/components/builder-chrome";
import { Providers } from "@/components/providers";
import { isDemoMode, platformOwnerEmails } from "@/lib/env";
import { isThemeMode, themeCookieKey } from "@/lib/theme";
import { PLATFORM_NAME } from "@/lib/creators/platform";

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
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
