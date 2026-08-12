import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text, Pressable } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import {
  createExpenseSplitDraft,
  type SplitParticipant,
} from "../lib/expense-split";
import { ExpenseSplitEditor } from "./expense-split-editor";
import { ExpenseItemSplitSessionProvider } from "./expense-item-split-session";
import {
  ExpenseSplitSessionProvider,
  useExpenseSplitSession,
} from "./expense-split-session";

jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

jest.mock("@expo/ui/community/menu", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return {
    MenuView: ({
      children,
      ...props
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => <View {...props}>{children}</View>,
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
  const Toolbar = ({
    children,
    placement,
  }: {
    children: React.ReactNode;
    placement?: string;
  }) => (
    <MockView testID={`toolbar-${placement ?? "bottom"}`}>
      {children}
    </MockView>
  );
  Toolbar.Button = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <MockPressable {...props}>
      <MockText>{children}</MockText>
    </MockPressable>
  );
  Toolbar.View = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    router: { back: jest.fn(), push: jest.fn() },
    Stack: { Screen, Toolbar },
  };
});

const participants: SplitParticipant[] = [
  { userId: "a", displayName: "Alex", homeCurrency: "EUR" },
  { userId: "b", displayName: "Bea", homeCurrency: "EUR" },
];

function Harness({ onSave }: { onSave: jest.Mock }) {
  const session = useExpenseSplitSession();
  if (!session.request) {
    return (
      <Pressable
        onPress={() =>
          session.open({
            currency: "EUR",
            totalMinor: 7_000n,
            participants,
            draft: createExpenseSplitDraft(
              participants,
              7_000n,
              "EUR",
            ),
            onSave,
          })
        }
      >
        <Text>Open editor</Text>
      </Pressable>
    );
  }
  return <ExpenseSplitEditor />;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ExpenseSplitSessionProvider>
        <ExpenseItemSplitSessionProvider>
          {children}
        </ExpenseItemSplitSessionProvider>
      </ExpenseSplitSessionProvider>
    </SafeAreaInsetsContext.Provider>
  );
}

describe("ExpenseSplitEditor", () => {
  it("uses compact avatar rows and narrower percentage fields", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));
    await fireEvent(view.getByTestId("split-method-picker"), "pressAction", {
      nativeEvent: { event: "percentage" },
    });

    expect(view.getByText("A")).toBeTruthy();
    expect(view.getByText("B")).toBeTruthy();
    expect(view.getByText("Alex").props.style).toEqual(
      expect.objectContaining({ fontSize: 15 }),
    );
    const input = view.getByLabelText("Alex percentage");
    expect(input.parent?.props.style).toEqual(
      expect.objectContaining({ width: 88, minHeight: 34 }),
    );

    await fireEvent.changeText(input, "123456789012");
    expect(view.getByLabelText("Alex percentage").props.style).toEqual(
      expect.objectContaining({ fontSize: 13 }),
    );
  });

  it("only enables Done for a complete custom allocation", async () => {
    const onSave = jest.fn();
    const view = await render(<Harness onSave={onSave} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));
    await fireEvent(view.getByTestId("split-method-picker"), "pressAction", {
      nativeEvent: { event: "exact" },
    });

    await fireEvent.changeText(view.getByLabelText("Alex amount"), "50");
    expect(
      view.getByLabelText("85.00 € / 70.00 €, Incomplete"),
    ).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText("Bea amount"), "20");
    expect(
      view.getByLabelText("70.00 € / 70.00 €, Complete"),
    ).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Save split"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "exact",
        exactAmounts: { a: "50", b: "20" },
      }),
    );
  });

  it("starts new itemized entries unassigned and adds people explicitly", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));
    await fireEvent(view.getByTestId("split-method-picker"), "pressAction", {
      nativeEvent: { event: "itemized" },
    });
    await fireEvent.press(view.getByText("＋ Add item"));

    const peoplePicker = view.getByTestId("item-people-picker-0");
    expect(peoplePicker.props.actions).toMatchObject([
      {
        title: "Selection",
        displayInline: true,
        subactions: [
          { title: "Select All" },
          { title: "Deselect All" },
        ],
      },
      {
        title: "People",
        displayInline: true,
        subactions: [
          { id: "a", state: "off" },
          { id: "b", state: "off" },
        ],
      },
    ]);
    expect(view.getByText("For")).toBeTruthy();
    expect(view.queryByText("Shared by")).toBeNull();

    const { router } = jest.requireMock("expo-router") as {
      router: { push: jest.Mock };
    };
    router.push.mockClear();
    const emptyAllocationPicker = view.getByTestId(
      "item-allocation-picker-0",
    );
    expect(
      emptyAllocationPicker.props.actions.filter(
        (action: { state?: string }) => action.state === "on",
      ),
    ).toHaveLength(1);
    expect(
      emptyAllocationPicker.props.actions.find(
        (action: { id: string }) => action.id === "custom",
      ).attributes,
    ).toEqual({ disabled: true });
    await fireEvent(emptyAllocationPicker, "pressAction", {
      nativeEvent: { event: "custom" },
    });
    expect(router.push).not.toHaveBeenCalled();

    await fireEvent(peoplePicker, "pressAction", {
      nativeEvent: { event: "a" },
    });
    expect(
      view
        .getByTestId("item-people-picker-0")
        .props.actions.find(
          (action: { id: string }) => action.id === "__people__",
        ).subactions.find((action: { id: string }) => action.id === "a").state,
    ).toBe("on");
    expect(view.getByText("Split")).toBeTruthy();
    expect(view.getByText("Equally")).toBeTruthy();

    await fireEvent(
      view.getByTestId("item-allocation-picker-0"),
      "pressAction",
      { nativeEvent: { event: "custom" } },
    );
    expect(router.push).toHaveBeenCalledWith("/expense/item-split");
  });

  it("keeps allocation progress in the floating bottom overlay", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));

    expect(view.queryByTestId("toolbar-bottom")).toBeNull();
    expect(view.getByTestId("allocation-floating-summary")).toBeTruthy();
  });

  it("stays open and marks the split incomplete when everyone is deselected", async () => {
    const onSave = jest.fn();
    const view = await render(<Harness onSave={onSave} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));

    await fireEvent.press(view.getByLabelText("Include Alex"));
    await fireEvent.press(view.getByLabelText("Include Bea"));

    expect(
      view.getByLabelText("0 people selected, Incomplete"),
    ).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Save split"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("toggles a person from the row and supports bulk selection", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });
    await fireEvent.press(view.getByText("Open editor"));

    await fireEvent.press(view.getByText("Alex"));
    expect(view.getByLabelText("1 person selected, Complete")).toBeTruthy();

    await fireEvent.press(view.getByText("Deselect All"));
    expect(view.getByLabelText("0 people selected, Incomplete")).toBeTruthy();

    await fireEvent.press(view.getByText("Select All"));
    expect(view.getByLabelText("2 people selected, Complete")).toBeTruthy();
  });

  it("keeps its session mounted until the modal has finished closing", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await fireEvent.press(view.getByText("Open editor"));
    await fireEvent.press(view.getByLabelText("Cancel split"));

    expect(view.getByText("Split method")).toBeTruthy();
    expect(
      view.queryByText("The expense split is no longer available."),
    ).toBeNull();
  });
});
