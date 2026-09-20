import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ headers: vi.fn(), getArea: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); } }));
vi.mock("@/lib/creators/service", () => ({ getCreatorAreaBySlug: mocks.getArea }));

import CreatorAreaPage from "./page";
import { defaultCreatorTenant } from "@/lib/creators/tenant";

describe("creator public page boundary", () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    mocks.getArea.mockReset();
  });

  it("renders an available creator and passes the incoming hostname", async () => {
    mocks.getArea.mockResolvedValue(defaultCreatorTenant);
    expect(await CreatorAreaPage({ params: Promise.resolve({ creatorSlug: "ludylops" }) })).toBeTruthy();
    expect(mocks.getArea).toHaveBeenCalledWith("ludylops", { hostname: "localhost:3000" });
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
