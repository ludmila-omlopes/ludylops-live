import { describe, expect, it } from "vitest";

import { getHomeHeroCopy } from "@/lib/home-hero-copy";

describe("getHomeHeroCopy", () => {
  it("does not say the stream is online for a signed-in viewer while offline", () => {
    const copy = getHomeHeroCopy({
      accountProtectionStatus: null,
      hasUsableSession: true,
      isLive: false,
    });

    expect(copy.title).toBe("A live está offline agora.");
    expect(copy.description).toBe(
      "Enquanto eu não abro a live, você pode conferir seu painel, sugerir jogos e deixar tudo pronto para a próxima transmissão.",
    );
  });

  it("uses the online call to action for a signed-in viewer while live", () => {
    const copy = getHomeHeroCopy({
      accountProtectionStatus: null,
      hasUsableSession: true,
      isLive: true,
    });

    expect(copy.title).toBe("Estou online, vem pra live!");
    expect(copy.description).toBe(
      "Entre nas apostas, acione resgates e leve suas sugestões para o que acontece ao vivo.",
    );
  });

  it("keeps the public offline introduction for visitors", () => {
    const copy = getHomeHeroCopy({
      accountProtectionStatus: null,
      hasUsableSession: false,
      isLive: false,
    });

    expect(copy.title).toBe("Oi, eu sou a Ludylops. Eu jogo, o chat palpita.");
  });
});
