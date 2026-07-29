import { describe, expect, it } from "vitest";
import {
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
