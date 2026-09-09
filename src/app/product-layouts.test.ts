import React from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  isLive: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Archivo_Black: () => ({ variable: "font-display" }),
  DM_Sans: () => ({ variable: "font-body" }),
  Geist: () => ({ variable: "font-sans" }),
  IBM_Plex_Mono: () => ({ variable: "font-mono" }),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
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

import RootLayout from "@/app/layout";
import BuilderLayout, { metadata as builderMetadata } from "@/app/(builder)/layout";
import CommunityLayout, { metadata as communityMetadata } from "@/app/(community)/layout";
import CreatorPublicLayout, { metadata as creatorMetadata } from "@/app/(creator-public)/layout";
import ObsLayout from "@/app/obs/layout";

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

    expect(providers.type).toBeTypeOf("function");
    expect((providers.type as Function).name).toBe("Providers");
    expect(chrome.type).toBeTypeOf("function");
    expect((chrome.type as Function).name).toBe("AppChrome");
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

    expect(providers.type).toBeTypeOf("function");
    expect((providers.type as Function).name).toBe("Providers");
    expect(chrome.type).toBeTypeOf("function");
    expect((chrome.type as Function).name).toBe("BuilderChrome");
    expect(propsOf(chrome)).toMatchObject({ initialTheme: "dark", isPlatformOwner: true });
    expect(propsOf(chrome).children).toBe(children);
    expect(mocks.auth).toHaveBeenCalledOnce();
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
    expect(obsShell.type).toBeTypeOf("function");
    expect((obsShell.type as Function).name).toBe("ObsShell");
  });

  it("defines product-specific metadata", () => {
    expect(builderMetadata).toEqual({
      title: "Comunidades",
      description: "Prepare o encontro da sua comunidade com a próxima live.",
    });
    expect(creatorMetadata).toEqual({ title: "Comunidade" });
    expect(communityMetadata.title).toBe("Ludylops Games: eu disseco jogos no YouTube");
    expect(communityMetadata.description).toContain("Acompanhe o jogo atual");
    expect(JSON.stringify(builderMetadata)).not.toContain("Ludylops Games");
    expect(JSON.stringify(creatorMetadata)).not.toContain("Ludylops Games");
  });
});
