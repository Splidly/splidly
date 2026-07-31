import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import type { SplitParticipant } from "../lib/expense-split";
import { ExpensePaymentEditor } from "./expense-payment-editor";
import {
  ExpensePaymentSessionProvider,
  useExpensePaymentSession,
} from "./expense-payment-session";

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
  } = require("react-native") as typeof import("react-native");
  const Screen = () => null;
  const Toolbar = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
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
    router: { back: jest.fn() },
    Stack: { Screen, Toolbar },
  };
});

const participants: SplitParticipant[] = [
  { userId: "a", displayName: "Alex", homeCurrency: "EUR" },
  { userId: "b", displayName: "Bea", homeCurrency: "EUR" },
];

function Harness({ onSave }: { onSave: jest.Mock }) {
  const session = useExpensePaymentSession();
  if (!session.request) {
    return (
      <Pressable
        onPress={() =>
          session.open({
            currency: "EUR",
            totalMinor: 7_000n,
            participants,
            draft: { payerIds: ["a"], payerAmounts: {} },
            onSave,
          })
        }
      >
        <Text>Open editor</Text>
      </Pressable>
    );
  }
  return <ExpensePaymentEditor />;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ExpensePaymentSessionProvider>
        {children}
      </ExpensePaymentSessionProvider>
    </SafeAreaInsetsContext.Provider>
  );
}

describe("ExpensePaymentEditor", () => {
  it("keeps the focused editor incomplete until all payer amounts add up", async () => {
    const onSave = jest.fn();
    const view = await render(<Harness onSave={onSave} />, {
      wrapper: Wrapper,
    });

    await fireEvent.press(view.getByText("Open editor"));
    expect(view.getByText("A")).toBeTruthy();
    expect(view.getByText("B")).toBeTruthy();
    await fireEvent(view.getByLabelText("Bea paid"), "valueChange", true);
    const amountInput = view.getByLabelText("Alex paid amount");
    expect(amountInput.props.style).toEqual(
      expect.objectContaining({ flex: 1, minWidth: 24, fontSize: 15 }),
    );
    expect(amountInput.parent?.props.style).toEqual(
      expect.objectContaining({ width: 104, minHeight: 34 }),
    );
    await fireEvent.changeText(view.getByLabelText("Alex paid amount"), "50");

    expect(
      view.getByLabelText("85.00 € of 70.00 €, Incomplete"),
    ).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText("Bea paid amount"), "20");
    expect(
      view.getByLabelText("70.00 € of 70.00 €, Complete"),
    ).toBeTruthy();

    await fireEvent.press(
      view.getByLabelText("Save payment allocation"),
    );
    expect(onSave).toHaveBeenCalledWith({
      payerIds: ["a", "b"],
      payerAmounts: { a: "50", b: "20" },
    });
  });

  it("keeps its session mounted until the modal has finished closing", async () => {
    const view = await render(<Harness onSave={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await fireEvent.press(view.getByText("Open editor"));
    await fireEvent.press(
      view.getByLabelText("Cancel payment allocation"),
    );

    expect(view.getByText("Alex")).toBeTruthy();
    expect(
      view.queryByText("The payment allocation is no longer available."),
    ).toBeNull();
  });
});
