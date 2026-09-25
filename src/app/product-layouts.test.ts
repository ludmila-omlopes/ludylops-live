import React from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  isLive: vi.fn(),
  tenant: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Archivo_Black: () => ({ variable: "font-display" }),
  DM_Sans: () => ({ variable: "font-body" }),
  Geist: () => ({ variable: "font-sans" }),
  IBM_Plex_Mono: () => ({ variable: "font-mono" }),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: async () => new Headers({ host: "localhost" }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/lib/creators/tenant", () => ({ resolvePublicCreatorFromRequest: mocks.tenant }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/streamerbot/live-status", () => ({
  isStreamerbotLivestreamActive: mocks.isLive,
}));
vi.mock("@/components/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) =>
    React.createElement("providers", null, children),
}));
vi.mock("@/components/app-chrome", () => ({
  AppChrome: (props: Record<string, unknown>) => React.createElement("app-chrome", props),
}));
vi.mock("@/components/builder-chrome", () => ({
  BuilderChrome: (props: Record<string, unknown>) => React.createElement("builder-chrome", props),
}));
vi.mock("@/components/obs-shell", () => ({
  ObsShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("obs-shell", null, children),
}));

import { DEFAULT_CREATOR_MODULES } from "@/lib/creators/defaults";

import RootLayout from "@/app/layout";
import BuilderLayout, { metadata as builderMetadata } from "@/app/(builder)/layout";
import CommunityLayout, { metadata as communityMetadata } from "@/app/(community)/layout";
import CreatorPublicLayout, { metadata as creatorMetadata } from "@/app/(creator-public)/layout";
import ObsLayout from "@/app/obs/layout";
import { AppChrome } from "@/components/app-chrome";
import { BuilderChrome } from "@/components/builder-chrome";
import { ObsShell } from "@/components/obs-shell";
import { Providers } from "@/components/providers";

function elementChildren(element: React.ReactElement) {
  const props = element.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children) as React.ReactElement[];
}

function propsOf(element: React.ReactElement) {
  return element.props as Record<string, unknown> & { children?: React.ReactNode };
}

describe("product layouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "dark" }) });
    mocks.auth.mockResolvedValue({
      user: { email: "owner@example.com", isLinked: false },
    });
    mocks.isLive.mockResolvedValue(true);
    mocks.tenant.mockResolvedValue({ creator: { id: "creator_ludylops", status: "active" }, modules: DEFAULT_CREATOR_MODULES });
  });

  it("keeps the root neutral and limited to theme cookies", async () => {
    const children = React.createElement("div", null, "child");
    const result = await RootLayout({ children });
    const body = elementChildren(result)[0];

    expect(result.type).toBe("html");
    expect(body.type).toBe("body");
    expect(propsOf(body).children).toBe(children);
    expect(mocks.cookies).toHaveBeenCalledOnce();
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.isLive).not.toHaveBeenCalled();
  });

  it("resolves community session, theme, permissions, and live state", async () => {
    const children = React.createElement("div", null, "community");
    const result = await CommunityLayout({ children });
    const providers = result as React.ReactElement;
    const chrome = elementChildren(providers)[0];

    expect(providers.type).toBe(Providers);
    expect(chrome.type).toBe(AppChrome);
    expect(propsOf(chrome)).toMatchObject({
      session: expect.objectContaining({ user: expect.objectContaining({ email: "owner@example.com" }) }),
      isAdmin: true,
      isPlatformOwner: true,
      isLive: true,
      initialTheme: "dark",
      showViewerLinkingAlert: true,
    });
    expect(propsOf(chrome).children).toBe(children);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.isLive).toHaveBeenCalledOnce();
  });

  it("does not consult live state in the builder", async () => {
    mocks.isLive.mockRejectedValue(new Error("builder must not call livestream state"));
    const children = React.createElement("div", null, "builder");
    const result = await BuilderLayout({ children });
    const providers = result as React.ReactElement;
    const chrome = elementChildren(providers)[0];

    expect(providers.type).toBe(Providers);
    expect(chrome.type).toBe(BuilderChrome);
    expect(propsOf(chrome)).toMatchObject({ initialTheme: "dark", isPlatformOwner: true });
    expect(propsOf(chrome).children).toBe(children);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.isLive).not.toHaveBeenCalled();
  });

  it.each([null, { creator: { id: "creator_other" } }])("blocks unscoped community dependencies for other or invalid creators", async tenant => {
    mocks.tenant.mockResolvedValue(tenant);
    await expect(CommunityLayout({ children: null })).rejects.toThrow("not_found");
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.isLive).not.toHaveBeenCalled();
  });

  it("keeps creator-public and OBS free of community providers", () => {
    const children = React.createElement("div", null, "public");
    const creatorResult = CreatorPublicLayout({ children });
    const obsResult = ObsLayout({ children });

    expect(creatorResult.type).toBe("main");
    expect(propsOf(creatorResult).children).toBe(children);
    expect(obsResult.type).toBe(React.Suspense);
    const obsShell = elementChildren(obsResult)[0];
    expect(obsShell.type).toBe(ObsShell);
  });

  it("defines product-specific metadata", () => {
    expect(builderMetadata).toEqual({
      title: { default: "Creator Hub", template: "%s · Creator Hub" },
      description: "Prepare o encontro da sua comunidade com a próxima live.",
    });
    expect(creatorMetadata).toEqual({ title: "Comunidade" });
    expect(communityMetadata.title).toBe("Ludylops Games: eu disseco jogos no YouTube");
    expect(communityMetadata.description).toContain("Acompanhe o jogo atual");
    expect(JSON.stringify(builderMetadata)).not.toContain("Ludylops Games");
    expect(JSON.stringify(creatorMetadata)).not.toContain("Ludylops Games");
  });
});
