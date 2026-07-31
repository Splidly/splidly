import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import {
  GroupListRow,
  GroupListSummary,
} from "./group-list-row";

describe("GroupListRow", () => {
  it("shows a large group entry with both repayment directions", async () => {
    const onPress = jest.fn();
    const view = await render(
      <GroupListRow
        id="group-1"
        name="Lisbon"
        iconKey="trip"
        balance={{ currency: "EUR", minor: "425" }}
        memberBalances={[
          {
            userId: "alex",
            displayName: "Alex",
            balance: { currency: "EUR", minor: "-800" },
          },
          {
            userId: "sam",
            displayName: "Sam",
            balance: { currency: "EUR", minor: "1225" },
          },
        ]}
        onPress={onPress}
      />,
    );

    expect(view.getByText("Lisbon")).toBeTruthy();
    expect(view.getByLabelText("You owe Alex 8.00 €")).toBeTruthy();
    expect(view.getByLabelText("Sam owes you 12.25 €")).toBeTruthy();
    expect(view.getByText("You are owed")).toBeTruthy();
    expect(view.getByText("4.25 €")).toBeTruthy();

    const alexLine = view.getByLabelText("You owe Alex 8.00 €");
    await fireEvent(alexLine, "textLayout", {
      nativeEvent: { lines: [{}, {}] },
    });
    expect(
      view.getByLabelText("You owe Alex 8.00 €").props.children[0],
    ).toBe("You owe A.");

    const row = view.getByLabelText("Lisbon, You are owed 4.25 €");
    expect(StyleSheet.flatten(row.props.style)).toEqual(
      expect.objectContaining({
        marginHorizontal: -16,
        paddingHorizontal: 20,
      }),
    );
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("replaces a zero amount with a settled status", async () => {
    const view = await render(
      <GroupListRow
        id="group-1"
        name="Home"
        iconKey="home"
        balance={{ currency: "EUR", minor: "0" }}
        memberBalances={[]}
        onPress={jest.fn()}
      />,
    );

    expect(view.queryByText("All settled up")).toBeNull();
    expect(view.getByText("Settled up")).toBeTruthy();
    expect(view.queryByText("0.00 €")).toBeNull();
  });
});

describe("GroupListSummary", () => {
  it("renders each overall direction in its own tone-aware segment", async () => {
    const view = await render(
      <GroupListSummary
        lines={[
          {
            key: "owes",
            label: "You owe",
            text: "You owe 8.00 €",
            amount: "8.00 €",
            tone: "negative",
          },
          {
            key: "owed",
            label: "You are owed",
            text: "You are owed 12.25 €",
            amount: "12.25 €",
            tone: "positive",
          },
        ]}
      />,
    );

    expect(view.getByLabelText("You owe 8.00 €")).toBeTruthy();
    expect(view.getByLabelText("You are owed 12.25 €")).toBeTruthy();
  });
});
