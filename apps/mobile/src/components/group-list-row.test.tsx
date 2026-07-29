import { fireEvent, render } from "@testing-library/react-native";
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
    expect(view.getByText("You owe Alex 8.00 EUR")).toBeTruthy();
    expect(view.getByText("Sam owes you 12.25 EUR")).toBeTruthy();
    expect(view.getByText("You are owed")).toBeTruthy();
    expect(view.getByText("4.25 EUR")).toBeTruthy();

    await fireEvent.press(view.getByLabelText("Lisbon, You are owed 4.25 EUR"));
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

    expect(view.getByText("All settled up")).toBeTruthy();
    expect(view.getByText("Settled up")).toBeTruthy();
    expect(view.queryByText("0.00 EUR")).toBeNull();
  });
});

describe("GroupListSummary", () => {
  it("renders each overall direction in its own tone-aware segment", async () => {
    const view = await render(
      <GroupListSummary
        lines={[
          { key: "owes", text: "You owe 8.00 EUR", tone: "negative" },
          {
            key: "owed",
            text: "You are owed 12.25 EUR",
            tone: "positive",
          },
        ]}
      />,
    );

    expect(view.getByText("You owe 8.00 EUR")).toBeTruthy();
    expect(view.getByText("You are owed 12.25 EUR")).toBeTruthy();
  });
});
