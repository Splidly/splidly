import { fireEvent, render } from "@testing-library/react-native";
import { CurrencyField } from "./currency-field";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

describe("CurrencyField", () => {
  it("shows the selected currency name when it fits", async () => {
    const view = await render(
      <CurrencyField
        label="Currency"
        value="EUR"
        onValueChange={jest.fn()}
      />,
    );

    expect(view.getByText("Euro")).toBeTruthy();
  });

  it("falls back to symbol and code when the name wraps", async () => {
    const view = await render(
      <CurrencyField
        label="Currency"
        value="TTD"
        onValueChange={jest.fn()}
      />,
    );
    const currencyName = view.getByText("Trinidad and Tobago Dollar");

    await fireEvent(currencyName, "textLayout", {
      nativeEvent: { lines: [{}, {}] },
    });

    expect(view.getByText("TT$ · TTD")).toBeTruthy();
  });
});
