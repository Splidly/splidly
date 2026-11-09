import { expensePreviewActions, friendPreviewActions, groupPreviewActions, settlementPreviewActions } from "./activity-preview-actions";

it("shows settlement only for groups with outstanding balances and routes every action", () => {
  const open = jest.fn();
  expect(groupPreviewActions("g", false, open).map((action) => action.id)).toEqual([
    "add-expense", "statistics", "settings",
  ]);
  const actions = groupPreviewActions("g", true, open);
  actions.forEach((action) => action.onPress());
  expect(open.mock.calls.map(([href]) => href)).toEqual([
    { pathname: "/expense/new", params: { type: "group", id: "g" } },
    { pathname: "/settlement/group", params: { id: "g" } },
    "/groups/g/statistics", "/groups/g/settings",
  ]);
});

it("opens the correct direct ledger for a friend's expense and payment", () => {
  const open = jest.fn();
  friendPreviewActions("f", "anna", "USD", open).forEach((action) => action.onPress());
  expect(open.mock.calls.map(([href]) => href)).toEqual([
    { pathname: "/expense/new", params: { type: "friend", id: "f" } },
    { pathname: "/settlement/new", params: { type: "friend", id: "f", friendshipId: "f", friendId: "anna", canonicalCurrency: "USD" } },
    "/friends/f",
  ]);
  expect(friendPreviewActions("f", undefined, "EUR", open).filter((action) => action.disabled).map((action) => action.id))
    .toEqual(["add-expense", "record-payment"]);
});

it("duplicates into a new draft and reuses the existing delete confirmation", async () => {
  const open = jest.fn();
  const remove = jest.fn(async () => false);
  const actions = expensePreviewActions("e", open, remove, false);
  await actions[0]!.onPress();
  await actions[1]!.onPress();
  expect(open.mock.calls.map(([href]) => href)).toEqual([
    "/expense/e/edit", { pathname: "/expense/new", params: { duplicateExpenseId: "e" } },
  ]);
  expect(remove).not.toHaveBeenCalled();
  expect(actions[2]!.destructive).toBe(true);
  await actions[2]!.onPress();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(expensePreviewActions("e", open, remove, true).every((action) => action.disabled)).toBe(true);
});

it.each([false, true])("opens settlement details and edits in the correct context (friend=%s)", async (friend) => {
  const open = jest.fn();
  const remove = jest.fn(async () => false);
  const settlement = { id: "s", from: { userId: "anna", isViewer: false }, to: { userId: "me", isViewer: true } };
  const context = friend ? { type: "friend" as const, friendshipId: "f" } : { type: "group" as const, groupId: "g" };
  const actions = settlementPreviewActions(settlement, context, "EUR", open, remove, false);
  await actions[0]!.onPress();
  await actions[1]!.onPress();
  expect(open.mock.calls.map(([href]) => href)).toEqual([
    { pathname: "/settlement/[id]", params: { id: "s" } },
    { pathname: "/settlement/new", params: {
      type: friend ? "friend" : "group", id: friend ? "f" : "g",
      ...(friend ? { friendshipId: "f", friendId: "anna" } : {}),
      canonicalCurrency: "EUR", settlementId: "s",
    } },
  ]);
  expect(remove).not.toHaveBeenCalled();
  expect(actions[2]!.destructive).toBe(true);
  await actions[2]!.onPress();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(settlementPreviewActions(settlement, context, "EUR", open, remove, true).every((action) => action.disabled)).toBe(true);
});
