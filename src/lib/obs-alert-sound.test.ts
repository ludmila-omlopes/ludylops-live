import { describe, expect, it } from "vitest";
import { readAlertSoundSettings } from "./obs-alert-sound";

const params = (query: string) => new URLSearchParams(query);

describe("OBS alert sound settings", () => {
  it("defaults to the chime at 80% volume", () => {
    expect(readAlertSoundSettings(params(""))).toEqual({ muted: false, soundUrl: null, volume: 0.8 });
  });
  it("reads a custom file and clamps the volume", () => {
    expect(readAlertSoundSettings(params("sound=https://cdn.test/plim.mp3&volume=3")))
      .toEqual({ muted: false, soundUrl: "https://cdn.test/plim.mp3", volume: 1 });
    expect(readAlertSoundSettings(params("soundUrl=https://cdn.test/a.mp3&volume=abc")).volume).toBe(0.8);
  });
  it.each(["sound=off", "sound=none", "volume=0"])("silences with %s", query => {
    expect(readAlertSoundSettings(params(query))).toMatchObject({ muted: true, soundUrl: null });
  });
});
