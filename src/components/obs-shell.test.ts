// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ObsShell } from "@/components/obs-shell";

describe("ObsShell", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    document.body.removeAttribute("data-obs-overlay");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.removeAttribute("data-obs-overlay");
  });

  it("sets transparency state on mount and cleans it on unmount", () => {
    act(() => {
      root.render(React.createElement(ObsShell, null, React.createElement("span", null, "overlay")));
    });

    expect(document.body.dataset.obsOverlay).toBe("true");
    expect(container.textContent).toBe("overlay");

    act(() => root.unmount());
    expect(document.body.dataset.obsOverlay).toBeUndefined();
  });

  it("does not leave OBS state when community content follows", () => {
    act(() => {
      root.render(React.createElement(ObsShell, null, React.createElement("span", null, "overlay")));
    });
    act(() => root.unmount());

    const communityRoot = createRoot(container);
    act(() => communityRoot.render(React.createElement("main", null, "community")));

    expect(document.body.dataset.obsOverlay).toBeUndefined();
    expect(container.textContent).toBe("community");

    act(() => communityRoot.unmount());
  });
});
