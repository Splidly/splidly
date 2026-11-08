import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { router } from "expo-router";
import SettlementDetailScreen from "../app/settlement/[id]";

const mockRemove = jest.fn();
const mockFriendDetailInvalidate = jest.fn(async () => undefined);
let mockDeleted: (() => Promise<void>) | undefined;
let mockFriendContext = false;
const mockInvalidate = jest.fn(async () => undefined);

jest.mock("expo-router", () => {
  const { Pressable } = require("react-native");
  const Toolbar = Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Button: ({ accessibilityLabel, onPress, disabled }: { accessibilityLabel: string; onPress: () => void; disabled: boolean }) => (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} />
    ) },
  );
  return {
    router: { push: jest.fn(), back: jest.fn() },
    Stack: { Screen: () => null, Toolbar },
    useLocalSearchParams: () => ({ id: "payment-1" }),
  };
});

jest.mock("../lib/trpc", () => ({
  api: {
    settlements: {
      detail: { useQuery: () => ({
        data: {
          settlement: {
            id: "payment-1", groupId: mockFriendContext ? null : "group-1",
            friendshipId: mockFriendContext ? "friendship-1" : null,
            fromUserId: "user-2", toUserId: "user-1",
            sourceCurrency: "EUR", sourceAmountMinor: 3000n,
            canonicalCurrency: "EUR", occurredAt: new Date("2026-11-06T12:00:00Z"),
            notes: "Cash after dinner", version: 4,
          },
          from: { userId: "user-2", displayName: "Alex Morgan", homeCurrency: "EUR" },
          to: { userId: "user-1", displayName: "Demo User", homeCurrency: "EUR" },
          rates: [],
        },
        isPending: false, error: null,
      }) },
      remove: { useMutation: ({ onSuccess }: { onSuccess: () => Promise<void> }) => {
        mockDeleted = onSuccess;
        return { mutate: mockRemove, isPending: false, error: null };
      } },
    },
    profile: { me: { useQuery: () => ({ data: { userId: "user-1", homeCurrency: "EUR" }, error: null }) } },
    useUtils: () => ({
      friends: { list: { invalidate: mockInvalidate }, detail: { invalidate: mockFriendDetailInvalidate } },
      groups: { list: { invalidate: mockInvalidate }, detail: { invalidate: mockInvalidate }, balances: { invalidate: mockInvalidate } },
    }),
  },
}));

function fixture() {
  return <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <SettlementDetailScreen />
  </SafeAreaInsetsContext.Provider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFriendContext = false;
});

it("opens a payment as read-only details with large parties and no editor controls", async () => {
  const view = await render(fixture());
  expect(view.getByLabelText("Paid by: Alex Morgan")).toBeTruthy();
  expect(view.getByLabelText("Paid to: You")).toBeTruthy();
  expect(view.getByText("30.00 €")).toBeTruthy();
  expect(view.getByText("Cash after dinner")).toBeTruthy();
  expect(view.queryByTestId("settlement-paid-by")).toBeNull();
  expect(view.queryByTestId("settlement-paid-to")).toBeNull();
  expect(view.container.queryAll((node) => typeof node.props.onChangeText === "function")).toHaveLength(0);
  expect(view.queryByText("Save changes")).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText("Close payment details"));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it.each([false, true])("opens the editor explicitly and prevents duplicate presentations (friend=%s)", async (friend) => {
  mockFriendContext = friend;
  const view = await render(fixture());
  await fireEvent.press(view.getByLabelText("Edit payment"));
  await fireEvent.press(view.getByLabelText("Edit payment"));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/settlement/new",
    params: {
      type: friend ? "friend" : "group",
      id: friend ? "friendship-1" : "group-1",
      ...(friend ? { friendshipId: "friendship-1", friendId: "user-2" } : {}),
      canonicalCurrency: "EUR", settlementId: "payment-1", returnToDetail: "true",
    },
  });
});

it("requires confirmation before deleting from the detail view", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const view = await render(fixture());
    await fireEvent.press(view.getByText("Delete payment"));
    expect(mockRemove).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2];
    expect(buttons?.[0]).toMatchObject({ text: "Cancel", style: "cancel" });
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
    expect(mockRemove).toHaveBeenCalledWith({ settlementId: "payment-1", expectedVersion: 4 });
  } finally { alert.mockRestore(); }
});

it("refreshes cached friend details after deleting a group payment", async () => {
  await render(fixture());
  await act(async () => mockDeleted?.());
  expect(mockFriendDetailInvalidate).toHaveBeenCalledWith();
  expect(router.back).toHaveBeenCalledTimes(1);
});
