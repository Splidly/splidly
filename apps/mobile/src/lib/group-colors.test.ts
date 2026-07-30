import { groupColorPresets } from "@splidly/shared";
import {
  groupActionColorsFor,
  groupIconColorsFor,
  hexToRgb,
  normalizeGroupColor,
  rgbToHex,
} from "./group-colors";

describe("group colors", () => {
  it("normalizes custom colors and preserves RGB round trips", () => {
    expect(normalizeGroupColor("#a1b2c3", "group-1")).toBe("#A1B2C3");
    expect(rgbToHex(hexToRgb("#A1B2C3"))).toBe("#A1B2C3");
  });

  it("uses the saturated preset as the light tile background", () => {
    const accent = groupColorPresets[0];
    expect(groupIconColorsFor(accent, "group-1", "light")).toEqual({
      background: accent,
      foreground: "#E8E7FF",
    });
  });

  it("derives readable filled and tinted group actions", () => {
    expect(groupActionColorsFor("#4745B8", "group-1", "light")).toEqual({
      primaryBackground: "#4745B8",
      primaryForeground: "#FFFFFF",
      secondaryBackground: "#DEDEF2",
      secondaryForeground: "#4745B8",
    });
  });
});
