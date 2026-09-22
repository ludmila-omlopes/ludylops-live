import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tenant: vi.fn() }));
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test", activeViewerId: "viewer" } })),
}));
vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    throw new Error("operational storage must not be accessed");
  },
}));
vi.mock("@/lib/creators/tenant", () => ({
  resolvePublicCreatorFromRequest: state.tenant,
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireLinkedApiSession: async () => ({
    user: { id: "test", activeViewerId: "viewer" },
  }),
  requireAdminApiSession: async () => ({ user: { id: "test" } }),
  isTrustedAppMutationRequest: () => true,
}));
import {
  DEFAULT_CREATOR_ID,
  DEFAULT_CREATOR_MODULES,
} from "@/lib/creators/defaults";
import {
  modulePages,
  moduleApiGroups,
  modulesForApi,
  sharedApiGroups,
  integrationApiGroups,
  aggregatePages,
  sharedPages,
} from "@/lib/creators/module-entry-points";
import { creatorModuleCatalog } from "@/lib/creators/modules";

const root = path.resolve("src/app");
function files(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
function urlFor(file: string) {
  return (
    "/" +
    path
      .relative(root, path.dirname(file))
      .replaceAll("\\", "/")
      .split("/")
      .filter((part) => !part.startsWith("("))
      .join("/")
  );
}
const routes = files(path.join(root, "api")).filter(
  (file) => file.endsWith("/route.ts") || file.endsWith("\\route.ts"),
);
const pages = files(root).filter((file) => /[/\\]page\.tsx$/.test(file));
const matches = (pathname: string, groups: object) =>
  Object.keys(groups).some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

describe("reviewed module entry-point inventory", () => {
  it("classifies every API and page, including shared infrastructure", () => {
    expect(
      routes
        .filter(
          (file) =>
            !modulesForApi(urlFor(file)) &&
            !matches(urlFor(file), sharedApiGroups) &&
            !matches(urlFor(file), integrationApiGroups),
        )
        .map(urlFor),
    ).toEqual([]);
    expect(
      pages
        .map(urlFor)
        .filter(
          (url) =>
            !modulePages[url] &&
            !(url in aggregatePages) &&
            !(url in sharedPages),
        ),
    ).toEqual([]);
  });
  it("keeps catalog public/OBS paths and inventory mapped to existing pages", () => {
    const actual = pages.map(urlFor);
    for (const manifest of creatorModuleCatalog)
      for (const url of [...manifest.publicRoutes, ...manifest.obsRoutes])
        expect(actual, `${manifest.key}: ${url}`).toContain(url);
    for (const url of Object.keys(modulePages)) expect(actual).toContain(url);
    for (const prefix of Object.keys(moduleApiGroups))
      expect(
        routes.some(
          (file) =>
            urlFor(file) === prefix || urlFor(file).startsWith(prefix + "/"),
        ),
        prefix,
      ).toBe(true);
  });
  it("maps every actual admin control to a manifest or the explicit beta-access exception", () => {
    const source = ts.createSourceFile(
      "admin.tsx",
      fs.readFileSync(path.join(root, "(community)/admin/page.tsx"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const controls: string[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isObjectLiteralExpression(node) &&
        node.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === "content",
        )
      ) {
        const id = node.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === "id",
        ) as ts.PropertyAssignment;
        controls.push((id.initializer as ts.StringLiteral).text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    const catalogControls = creatorModuleCatalog.flatMap((manifest) => [
      ...manifest.adminPanels,
    ]) as string[];
    expect(
      controls.filter(
        (id) => id !== "areas-criadores" && !catalogControls.includes(id),
      ),
    ).toEqual([]);
    expect(catalogControls.filter((id) => !controls.includes(id))).toEqual([]);
  });
});

describe("every public/admin/OBS API rejects unavailable modules before operational storage", () => {
  beforeEach(() => state.tenant.mockReset());
  for (const file of routes.filter((file) => modulesForApi(urlFor(file)))) {
    const pathname = urlFor(file);
    it(pathname, async () => {
      const route = await import(file);
      const handlers = Object.entries(route).filter(([method]) =>
        ["GET", "POST", "PATCH", "DELETE", "PUT"].includes(method),
      );
      expect(handlers.length).toBeGreaterThan(0);
      // Exercise every handler, each owned module, and a transitive missing dependency.
      const keys = modulesForApi(pathname)!;
      const disabledSets = [
        ...keys.map((key) => [key]),
        ["streamerbot", "points", "obs_overlays", ...keys],
      ];
      for (const disabled of disabledSets) {
        state.tenant.mockResolvedValue({
          creator: { id: DEFAULT_CREATOR_ID, status: "active" },
          modules: DEFAULT_CREATOR_MODULES.map((row) => ({
            ...row,
            status: disabled.includes(row.moduleKey) ? "disabled" : row.status,
          })),
        });
        for (const [method, handler] of handlers) {
          const response = await (
            handler as (request: Request, ctx: unknown) => Promise<Response>
          )(
            new Request(`https://ludylops.live${pathname}`, {
              method,
              ...(method !== "GET"
                ? {
                    body: "invalid-json",
                    headers: { origin: "https://ludylops.live" },
                  }
                : {}),
            }),
            {
              params: Promise.resolve({
                id: "test",
                betId: "test",
                quoteId: "1",
                youtubeChannelId: "test",
              }),
            },
          );
          expect(
            [403, 404],
            `${method} ${pathname} disabled ${disabled}`,
          ).toContain(response.status);
        }
      }
    });
  }
});
