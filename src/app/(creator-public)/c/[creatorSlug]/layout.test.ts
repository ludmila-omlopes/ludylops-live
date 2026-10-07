import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), session: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.session }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost" }) }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-hub" }),
  Geist_Mono: () => ({ variable: "font-hub-mono" }),
}));
vi.mock("@/lib/creators/service", () => ({ getCreatorAreaBySlug: mocks.tenant }));

import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

import CreatorCommunityLayout from "./layout";

function tenant(themeJson: Record<string, unknown>, id = "creator_mari") {
  return {
    creator: { id, slug: "canal-da-mari", status: "active" },
    branding: { primaryColor: "#ff7ac6", accentColor: "#102030", themeJson },
    modules: [],
  };
}

async function render(slug = "canal-da-mari") {
  const element = await CreatorCommunityLayout({
    children: React.createElement("p", null, "conteúdo"),
    params: Promise.resolve({ creatorSlug: slug }),
  });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe("creator community layout", () => {
  beforeEach(() => {
    mocks.tenant.mockReset();
  });

  it("applies the chosen template with the creator colors", async () => {
    mocks.tenant.mockResolvedValue(tenant({ template: "palco" }));
    const markup = await render();
    expect(markup).toContain('data-creator-template="palco"');
    expect(markup).toContain("--creator-primary:#ff7ac6");
    expect(markup).toContain("--creator-accent:#102030");
    expect(markup).toContain("--creator-accent-ink:#ffffff");
    expect(markup).toContain("conteúdo");
  });

  it("keeps communities without a stored choice on the neobrutalist template", async () => {
    mocks.tenant.mockResolvedValue(tenant({}));
    expect(await render()).toContain('data-creator-template="neobrutalista"');
  });

  it("leaves Ludylops and unknown communities to their pages", async () => {
    mocks.tenant.mockResolvedValue(tenant({ template: "palco" }, DEFAULT_CREATOR_ID));
    expect(await render()).toBe("<p>conteúdo</p>");
    mocks.tenant.mockResolvedValue(null);
    expect(await render()).toBe("<p>conteúdo</p>");
    mocks.tenant.mockRejectedValue(new Error("database_down"));
    expect(await render()).toBe("<p>conteúdo</p>");
  });
});
