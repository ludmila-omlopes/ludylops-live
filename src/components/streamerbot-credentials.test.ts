// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamerbotCredentials } from "./streamerbot-credentials";

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => { button.click(); });
}
describe("credential management controls", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  it("creates, hides the one-time secret, rotates and revokes with the creator endpoint", async () => {
    let credentials: { id: string; status: string; retiringUntil: string | null; lastUsedAt: string | null }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/owner/creators/creator-a/streamerbot-credentials");
      if (init?.method !== "POST") return Response.json({ ok: true, data: credentials });
      const payload = JSON.parse(String(init.body));
      if (payload.action === "revoke") { credentials = credentials.map((item) => ({ ...item, status: "revoked" })); return Response.json({ ok: true, data: {} }); }
      const id = payload.action === "rotate" ? "new-credential" : "initial-credential";
      credentials = [{ id, status: "active", retiringUntil: null, lastUsedAt: null }];
      return Response.json({ ok: true, data: { id, secret: "test-secret-once" } }, { status: 201 });
    });
    await act(async () => root.render(createElement(StreamerbotCredentials, { creatorId: "creator-a", enabled: true })));
    expect(fetchMock).not.toHaveBeenCalled();
    await click("Gerenciar credenciais"); await click("Criar credencial");
    expect(Array.from(container.querySelectorAll("input")).some((input) => input.value === "test-secret-once")).toBe(true);
    await click("Já salvei; ocultar segredo"); expect(container.querySelectorAll("input")).toHaveLength(0);
    await click("Substituir credencial");
    expect(JSON.parse(fetchMock.mock.calls.find(([, init]) => String(init?.body).includes('"rotate"'))![1].body)).toEqual({ action: "rotate", credentialId: "initial-credential" });
    await click("Já salvei; ocultar segredo"); await click("Revogar credencial");
    expect(container.textContent).toContain("Revogada");
    await click("Fechar credenciais"); await click("Gerenciar credenciais");
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
  it("reports unavailable storage without offering issuance", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: "Credenciais indisponíveis." }, { status: 503 }));
    await act(async () => root.render(createElement(StreamerbotCredentials, { creatorId: "creator-a", enabled: true })));
    await click("Gerenciar credenciais");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Credenciais indisponíveis.");
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Criar credencial")?.disabled).toBe(true);
  });
});
