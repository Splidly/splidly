import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import {
  initializeExpenseItemAllocation,
  type ExpenseSplitItemDraft,
  type SplitParticipant,
} from "../lib/expense-split";
import { ExpenseItemSplitEditor } from "./expense-item-split-editor";
import {
  ExpenseItemSplitSessionProvider,
  useExpenseItemSplitSession,
} from "./expense-item-split-session";

jest.mock("@expo/ui/community/menu", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    MenuView: ({ children, ...props }: { children: ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = require("react-native") as typeof import("react-native");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <MockView>{children}</MockView>
  );
  Toolbar.Button = ({ children, ...props }: { children?: React.ReactNode }) => (
    <MockPressable {...props}>
      <MockText>{children}</MockText>
    </MockPressable>
  );
  return {
    router: { back: jest.fn() },
    Stack: { Screen, Toolbar },
  };
});

const participants: SplitParticipant[] = [
  { userId: "a", displayName: "Alex", homeCurrency: "EUR" },
  { userId: "b", displayName: "Bea", homeCurrency: "EUR" },
];

const equalItem: ExpenseSplitItemDraft = {
  id: "meal",
  description: "Meal",
  amount: "70",
  participantIds: ["a", "b"],
  allocationMode: "equal",
  exactAmounts: {},
  percentages: {},
  shares: {},
};

function Harness({
  onSave,
  empty = false,
}: {
  onSave: jest.Mock;
  empty?: boolean;
}) {
  const session = useExpenseItemSplitSession();
  if (!session.request) {
    return (
      <Pressable
        onPress={() =>
          session.open({
            currency: "EUR",
            participants,
            item: initializeExpenseItemAllocation(
              empty ? { ...equalItem, participantIds: [] } : equalItem,
              "exact",
              "EUR",
            ),
            onSave,
          })
        }
      >
        <Text>Open item split</Text>
      </Pressable>
    );
  }
  return <ExpenseItemSplitEditor />;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ExpenseItemSplitSessionProvider>
        {children}
      </ExpenseItemSplitSessionProvider>
    </SafeAreaInsetsContext.Provider>
  );
}

describe("ExpenseItemSplitEditor", () => {
  it("validates and saves custom item amounts", async () => {
    const onSave = jest.fn();
    const view = await render(<Harness onSave={onSave} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open item split"));

    expect(view.getByLabelText("Alex item amount").props.value).toBe("35.00");
    await fireEvent.changeText(view.getByLabelText("Alex item amount"), "50");
    await fireEvent.changeText(view.getByLabelText("Bea item amount"), "20");
    await fireEvent.press(view.getByLabelText("Save item split"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        allocationMode: "exact",
        exactAmounts: { a: "50", b: "20" },
      }),
    );
  });

  it("switches the custom item to percentage allocation", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open item split"));
    await fireEvent(view.getByTestId("item-custom-split-method"), "pressAction", {
      nativeEvent: { event: "percentage" },
    });

    expect(
      view
        .getByTestId("item-custom-split-method")
        .props.actions.filter(
          (action: { state?: string }) => action.state === "on",
        ),
    ).toHaveLength(1);
    expect(view.getByLabelText("Alex item percentage").props.value).toBe("50");
    expect(view.getByLabelText("Bea item percentage").props.value).toBe("50");
  });

  it("stays safe when an empty item split session is restored", async () => {
    const view = await render(<Harness empty onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await fireEvent.press(view.getByText("Open item split"));

    expect(
      view.getByLabelText("0.00 € / 70.00 €, Incomplete"),
    ).toBeTruthy();
    expect(view.queryByText("Alex")).toBeNull();
  });
});
