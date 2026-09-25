import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ headers: vi.fn(), getArea: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT;${url}`); },
}));
vi.mock("@/lib/creators/service", () => ({ getCreatorAreaBySlug: mocks.getArea }));

import CreatorAreaPage from "./page";
import { defaultCreatorTenant } from "@/lib/creators/tenant";

describe("creator public page boundary", () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    mocks.getArea.mockReset();
  });

  it("renders an available creator and passes the incoming hostname", async () => {
    mocks.getArea.mockResolvedValue({ ...defaultCreatorTenant, creator: { ...defaultCreatorTenant.creator, id: "cozy", slug: "cozy" } });
    expect(await CreatorAreaPage({ params: Promise.resolve({ creatorSlug: "cozy" }) })).toBeTruthy();
    expect(mocks.getArea).toHaveBeenCalledWith("cozy", { hostname: "localhost:3000" });
  });

  it("opens the Ludylops community on its own domain after public resolution", async () => {
    mocks.getArea.mockResolvedValue(defaultCreatorTenant);
    await expect(CreatorAreaPage({ params: Promise.resolve({ creatorSlug: "ludylops" }) })).rejects.toThrow("NEXT_REDIRECT;https://ludylops.live");
  });

  it("uses a generic not-found response when public resolution refuses the creator", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-host": "unknown.example.com", host: "localhost:3000" }));
    mocks.getArea.mockResolvedValue(null);
    await expect(CreatorAreaPage({ params: Promise.resolve({ creatorSlug: "cozy" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.getArea).toHaveBeenCalledWith("cozy", { hostname: "unknown.example.com" });
  });

  it("does not replace a missing hostname with an implicitly trusted host", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    mocks.getArea.mockResolvedValue(null);
    await expect(CreatorAreaPage({ params: Promise.resolve({ creatorSlug: "cozy" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.getArea).toHaveBeenCalledWith("cozy", { hostname: null });
  });
});
