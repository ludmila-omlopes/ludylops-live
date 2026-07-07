import { describe, expect, it } from "vitest";

import { resolveCreatorLandingState } from "@/lib/creators/platform";

describe("resolveCreatorLandingState", () => {
  it("returns visitor when there is no usable session, regardless of access", () => {
    expect(resolveCreatorLandingState({ hasUsableSession: false, canCreateArea: false })).toBe("visitor");
    expect(resolveCreatorLandingState({ hasUsableSession: false, canCreateArea: true })).toBe("visitor");
  });

  it("returns closed_beta when the session is usable but the email is not allowed", () => {
    expect(resolveCreatorLandingState({ hasUsableSession: true, canCreateArea: false })).toBe("closed_beta");
  });

  it("returns approved when the session is usable and the email is allowed", () => {
    expect(resolveCreatorLandingState({ hasUsableSession: true, canCreateArea: true })).toBe("approved");
  });
});
