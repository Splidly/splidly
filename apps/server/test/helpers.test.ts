import { describe, expect, it } from "vitest";
import { groupBy } from "../src/domain/helpers";

describe("groupBy", () => {
  it("preserves value order while grouping bulk query results", () => {
    expect(
      groupBy(
        [
          { groupId: "one", value: 1 },
          { groupId: "two", value: 2 },
          { groupId: "one", value: 3 },
        ],
        (item) => item.groupId,
      ),
    ).toEqual(
      new Map([
        [
          "one",
          [
            { groupId: "one", value: 1 },
            { groupId: "one", value: 3 },
          ],
        ],
        ["two", [{ groupId: "two", value: 2 }]],
      ]),
    );
  });
});
