import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { CurrencyField } from "./currency-field";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

const mockPush = jest.mocked(router.push);

describe("CurrencyField", () => {
  beforeEach(() => mockPush.mockClear());

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

  it("opens the picker only once when pressed twice quickly", async () => {
    const view = await render(
      <CurrencyField
        label="Currency"
        value="EUR"
        onValueChange={jest.fn()}
      />,
    );
    const field = view.getByText("Currency");

    await fireEvent.press(field);
    await fireEvent.press(field);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/currency-picker");
  });
});
