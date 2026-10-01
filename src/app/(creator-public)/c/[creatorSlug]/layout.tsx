import { headers } from "next/headers";

import { hubMono } from "@/components/hub-home/fonts";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { creatorColorInk, safeCreatorColor } from "@/lib/creators/profile";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { creatorTemplateFrom } from "@/lib/creators/templates";

import "@/app/palco-theme.css";
import "@/app/neobrutal-creator-theme.css";

// Applies the creator's template and colors to every public page of the community.
// Unknown or unavailable communities render unwrapped; each page keeps its own checks.
export default async function CreatorCommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ creatorSlug: string }>;
}) {
  const { creatorSlug } = await params;
  const requestHeaders = await headers();
  let tenant: Awaited<ReturnType<typeof getCreatorAreaBySlug>> = null;
  try {
    tenant = await getCreatorAreaBySlug(creatorSlug, {
      hostname: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    });
  } catch {
    // The page reports lookup failures itself; the layout only skips theming.
  }

  if (!tenant || tenant.creator.id === DEFAULT_CREATOR_ID) {
    return children;
  }

  const template = creatorTemplateFrom(tenant.branding.themeJson);
  const primary = safeCreatorColor(tenant.branding.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(tenant.branding.accentColor, "#40a9ff");

  return (
    <div
      data-creator-template={template}
      className={template === "palco" ? hubMono.variable : undefined}
      style={
        {
          "--creator-primary": primary,
          "--creator-primary-ink": creatorColorInk(primary),
          "--creator-accent": accent,
          "--creator-accent-ink": creatorColorInk(accent),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
