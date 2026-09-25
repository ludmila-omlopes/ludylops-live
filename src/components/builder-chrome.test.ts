import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/auth-buttons", () => ({
  AuthButtons: () => React.createElement("span", null, "auth"),
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => React.createElement("span", null, "theme"),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("button", props, children as React.ReactNode),
}));

import { BuilderChrome } from "@/components/builder-chrome";

const BuilderChromeForTest = BuilderChrome as React.ComponentType<{
  children?: React.ReactNode;
  isPlatformOwner?: boolean;
  isSignedIn?: boolean;
}>;

describe("BuilderChrome", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("shows the public builder link to everyone", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: false }, "child"),
    );

    expect(markup).toContain('href="/criar-area"');
    expect(markup).toContain("Criar área");
    expect(markup).toContain("Creator Hub");
    expect(markup).not.toContain("Ludylops");
    expect(markup).not.toContain('href="/owner"');
  });

  it("points signed-in viewers to their communities instead of the landing", () => {
    mocks.pathname = "/comunidades/canal-da-mari";
    const markup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: false, isSignedIn: true }, "child"),
    );

    expect(markup).toContain('href="/comunidades"');
    expect(markup).toContain("Minhas comunidades");
    expect(markup).toContain('href="/comunidades/nova"');
    expect(markup).toContain("Nova comunidade");
    expect(markup).not.toContain("Criar área");
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="page"[^>]*href="\/comunidades"|href="\/comunidades"[^>]*aria-current="page"/);
  });

  it("marks only the new community link as current on the creation page", () => {
    mocks.pathname = "/comunidades/nova";
    const markup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: false, isSignedIn: true }, "child"),
    );

    expect(markup).toMatch(/href="\/comunidades\/nova"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/comunidades\/nova"/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("shows community administration only for platform owners", () => {
    const ownerMarkup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: true }, "child"),
    );
    const viewerMarkup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: false }, "child"),
    );

    expect(ownerMarkup).toContain('href="/owner"');
    expect(ownerMarkup).toContain("Administrar comunidades");
    expect(viewerMarkup).not.toContain('href="/owner"');
    expect(viewerMarkup).not.toContain("Administrar comunidades");
  });

  it("does not include community-only navigation or footer copy", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BuilderChromeForTest, { isPlatformOwner: true }, "child"),
    );

    expect(markup).not.toContain("Apostas");
    expect(markup).not.toContain("Ranking");
    expect(markup).not.toContain("Siga a Ludylops");
    expect(markup).not.toContain("Indicador");
    expect(markup).not.toContain("Vincule seu canal");
    expect(markup).not.toContain("Política de Privacidade");
  });
});
