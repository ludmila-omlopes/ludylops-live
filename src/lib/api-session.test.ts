import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

import { requireLinkedApiSession } from "@/lib/api";

function sessionWithViewer(input: {
  activeViewerId?: string;
  isLinked?: boolean;
}): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: {
      email: "viewer@example.com",
      activeViewerId: input.activeViewerId,
      isLinked: input.isLinked,
    },
  };
}

describe("requireLinkedApiSession", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns the session when the active viewer is linked", async () => {
    const session = sessionWithViewer({
      activeViewerId: "viewer_123",
      isLinked: true,
    });
    authMock.mockResolvedValue(session);

    await expect(requireLinkedApiSession()).resolves.toBe(session);
  });

  it("rejects a logged-in viewer that has not linked the YouTube channel", async () => {
    authMock.mockResolvedValue(
      sessionWithViewer({
        activeViewerId: "viewer_123",
        isLinked: false,
      }),
    );

    await expect(requireLinkedApiSession()).resolves.toBeNull();
  });

  it("rejects a session without an active viewer", async () => {
    authMock.mockResolvedValue(
      sessionWithViewer({
        isLinked: true,
      }),
    );

    await expect(requireLinkedApiSession()).resolves.toBeNull();
  });
});
