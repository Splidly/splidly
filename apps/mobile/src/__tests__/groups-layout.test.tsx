import { render } from "@testing-library/react-native";
import GroupsStackLayout from "../app/(tabs)/groups/_layout";

const mockScreens: {
  name: string;
  options?: Record<string, unknown>;
}[] = [];

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const Stack = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Stack.Screen = (props: {
    name: string;
    options?: Record<string, unknown>;
  }) => {
    mockScreens.push(props);
    return null;
  };
  return { Stack };
});

describe("GroupsStackLayout", () => {
  it("lets both group editor sheets follow their content height", async () => {
    mockScreens.length = 0;
    await render(<GroupsStackLayout />);

    for (const name of ["new", "[id]/edit"]) {
      expect(
        mockScreens.find((screen) => screen.name === name)?.options,
      ).toEqual(
        expect.objectContaining({
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetInitialDetentIndex: 0,
        }),
      );
    }
  });
});
