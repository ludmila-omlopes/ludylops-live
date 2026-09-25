import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), setup: vi.fn(), chat: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/creators/community-workspace.server", () => ({ loadCommunitySection: mocks.load }));
vi.mock("@/lib/creators/setup.server", () => ({ getOwnedCreatorSetup: mocks.setup }));
vi.mock("@/lib/creators/chat-rewards-settings.server", () => ({ getOwnedChatRewards: mocks.chat }));

import CommunityOverviewPage from "./page";
import { buildCreatorSetup } from "@/lib/creators/setup";
import { creatorModuleCatalog } from "@/lib/creators/modules";

const modules = creatorModuleCatalog.map((module) => ({ moduleKey: module.key, status: "installed", configJson: {} }));
const community = {
  id: "creator_1",
  slug: "canal-da-mari",
  displayName: "Canal da Mari",
  status: "active" as const,
  publicUrl: "https://hub.example.com/c/canal-da-mari",
  isLegacy: false,
  primaryColor: "#11aa99",
  accentColor: "#ffcc00",
};

describe("community overview", () => {
  beforeEach(() => {
    mocks.load.mockResolvedValue({ community, tenant: { creator: { id: community.id, status: "active" }, modules }, viewerId: "viewer_1" });
    mocks.setup.mockReset();
    mocks.chat.mockReset();
  });

  it("renders the first-live checklist without waiting for a click, linking to sections", async () => {
    mocks.setup.mockResolvedValue(
      buildCreatorSetup({
        creator: { id: community.id, slug: community.slug, displayName: community.displayName, status: "active" },
        modules,
        economyEnabled: true,
        credentials: { usable: 0, lastUsedAt: null },
        catalog: { total: 0, available: 0, completed: 0 },
      }),
    );
    mocks.chat.mockResolvedValue({ enabled: true, amount: 5, cooldownSeconds: 60 });

    const markup = renderToStaticMarkup(await CommunityOverviewPage({ params: Promise.resolve({ slug: community.slug }) }));

    expect(mocks.setup).toHaveBeenCalledWith("viewer_1", community.id);
    expect(markup).toContain("Antes da primeira live");
    expect(markup).toContain("etapas registradas");
    expect(markup).toContain('href="/comunidades/canal-da-mari/identidade"');
    expect(markup).toContain('href="/comunidades/canal-da-mari/integracao"');
    expect(markup).toContain("5 pontos a cada 1 min");
    expect(markup).not.toContain("#perfil-");
  });

  it("explains when the checklist cannot be verified", async () => {
    mocks.setup.mockRejectedValue(new Error("setup_unavailable"));
    mocks.chat.mockRejectedValue(new Error("unavailable"));

    const markup = renderToStaticMarkup(await CommunityOverviewPage({ params: Promise.resolve({ slug: community.slug }) }));

    expect(markup).toContain("Não foi possível verificar a configuração agora.");
  });
});
