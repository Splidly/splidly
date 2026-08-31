import { describe, expect, it } from "vitest";
import {
  assertGroupOwner,
  assertRecordCreator,
  groupBy,
} from "../src/domain/helpers";

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

describe("mutation authorization", () => {
  it("allows only the owner to manage a group", () => {
    expect(() => assertGroupOwner("owner", "owner")).not.toThrow();
    expect(() => assertGroupOwner("owner", "member")).toThrow(
      "Only the group owner",
    );
  });

  it("allows only a record creator to change shared financial content", () => {
    expect(() =>
      assertRecordCreator("creator", "creator", "expense"),
    ).not.toThrow();
    expect(() =>
      assertRecordCreator("creator", "member", "settlement"),
    ).toThrow("Only the person who created this settlement");
  });
});
