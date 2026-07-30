import { describe, expect, it } from "vitest";
import {
  groupColorPresets,
  groupColorSchema,
  groupIconKeys,
  groupIconKeySchema,
} from "../src";

describe("groupIconKeySchema", () => {
  it("accepts every supported semantic group icon", () => {
    for (const iconKey of groupIconKeys) {
      expect(groupIconKeySchema.parse(iconKey)).toBe(iconKey);
    }
  });

  it("rejects platform-specific and unknown icon names", () => {
    expect(groupIconKeySchema.safeParse("person.3.fill").success).toBe(false);
    expect(groupIconKeySchema.safeParse("unknown").success).toBe(false);
  });
});

describe("groupColorSchema", () => {
  it("accepts six-digit colors and normalizes them for storage", () => {
    expect(groupColorSchema.parse("#a1b2c3")).toBe("#A1B2C3");
  });

  it("keeps every preset valid and rejects non-hex values", () => {
    for (const color of groupColorPresets) {
      expect(groupColorSchema.parse(color)).toBe(color);
    }
    expect(groupColorSchema.safeParse("purple").success).toBe(false);
    expect(groupColorSchema.safeParse("#1234").success).toBe(false);
  });
});
