import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  tenant: vi.fn(),
  domain: vi.fn(() => {
    throw new Error("unexpected operational query");
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "ludylops.live" }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not_found");
  },
  usePathname: () => "/",
}));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: async () => ({ user: { email: "owner@test" } }),
}));
vi.mock("@/lib/creators/tenant", () => ({
  resolvePublicCreatorFromRequest: state.tenant,
}));
vi.mock("@/lib/db/client", () => ({ getDb: state.domain }));
vi.mock("@/lib/db/repository", async (original) =>
  Object.fromEntries(
    Object.entries(await original<object>()).map(([key, value]) => [
      key,
      typeof value === "function" ? state.domain : value,
    ]),
  ),
);
vi.mock("@/lib/streamerbot/live-status", () => ({
  isStreamerbotLivestreamActive: state.domain,
  getStreamerbotLivestreamStatus: state.domain,
}));
vi.mock("@/lib/streamerbot/current-game", () => ({
  getCurrentGame: state.domain,
}));
vi.mock("@/lib/creators/access", () => ({
  getCreatorAreaAccessSettings: async () => ({
    allowedEmails: [],
    updatedAt: null,
    updatedBy: null,
  }),
}));
import {
  DEFAULT_CREATOR_ID,
  DEFAULT_CREATOR_MODULES,
} from "@/lib/creators/defaults";
import { modulePages } from "@/lib/creators/module-entry-points";

function files(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
const root = path.resolve("src/app");
const pages = files(root).filter((file) => /[/\\]page\.tsx$/.test(file));
const urlFor = (file: string) =>
  "/" +
  path
    .relative(root, path.dirname(file))
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => !part.startsWith("("))
    .join("/");
describe("module pages and aggregate reads", () => {
  beforeEach(() => {
    state.domain.mockClear();
    state.tenant
      .mockReset()
      .mockResolvedValue({
        creator: { id: DEFAULT_CREATOR_ID, status: "active" },
        modules: DEFAULT_CREATOR_MODULES.map((row) => ({
          ...row,
          status: "disabled",
        })),
      });
  });
  for (const file of pages.filter((file) => modulePages[urlFor(file)])) {
    it(`denies ${urlFor(file)} before domain reads`, async () => {
      const page = (await import(file)).default;
      await expect(
        page({
          searchParams: Promise.resolve({}),
          params: Promise.resolve({ creatorSlug: "ludylops" }),
        }),
      ).rejects.toThrow("not_found");
      expect(state.domain).not.toHaveBeenCalled();
    });
  }
  it.each(["(community)/page.tsx", "(community)/admin/page.tsx"])(
    "renders %s without consulting disabled module data",
    async (file) => {
      const page = (await import(path.join(root, file))).default;
      expect(await page({ searchParams: Promise.resolve({}) })).toBeTruthy();
      expect(state.domain).not.toHaveBeenCalled();
    },
  );
});
