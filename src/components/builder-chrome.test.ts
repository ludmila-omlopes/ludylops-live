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
