import {
  androidFormHidesTabBar,
  expenseDetailSheetOptions,
  formSheetOptions,
  inlineLargeTitleOptions,
  nativeHeaderOptions,
} from "./navigation";

describe("androidFormHidesTabBar", () => {
  it.each([
    ["groups", "new"],
    ["groups", "[id]", "edit"],
    ["profile", "edit"],
    ["profile", "notifications"],
  ])("hides Android tabs while editing %s", (...route) => {
    expect(androidFormHidesTabBar(["(tabs)", ...route])).toBe(process.env.EXPO_OS === "android");
  });

  it.each([
    ["(tabs)", "groups", "index"],
    ["(tabs)", "groups", "[id]", "settings"],
    ["(tabs)", "profile", "index"],
    ["expense", "new"],
  ])("keeps ordinary collection and detail navigation visible: %s", (...route) => {
    expect(androidFormHidesTabBar(route)).toBe(false);
  });
});

describe("expenseDetailSheetOptions", () => {
  it("lets the compact sheet content scroll without first expanding", () => {
    expect(expenseDetailSheetOptions("#1c1c1e")).toEqual(
      expect.objectContaining({
        presentation: process.env.EXPO_OS === "android" ? "fullScreenModal" : "formSheet",
        sheetAllowedDetents: [0.65, 1],
        sheetInitialDetentIndex: 0,
        sheetExpandsWhenScrolledToEdge: false,
        sheetGrabberVisible: true,
      }),
    );
  });
});

describe("formSheetOptions", () => {
  it("keeps elevated sheet chrome opaque and out of the content flow", () => {
    expect(formSheetOptions("#1c1c1e")).toEqual({
      presentation: process.env.EXPO_OS === "android" ? "fullScreenModal" : "formSheet",
      headerTransparent: false,
      headerStyle: { backgroundColor: "#1c1c1e" },
      contentStyle: { backgroundColor: "#1c1c1e" },
    });
  });


});

describe("nativeHeaderOptions", () => {
  it("lets the first-child ScrollView drive UIKit's automatic scroll edge", () => {
    expect(nativeHeaderOptions("#000000")).toEqual(process.env.EXPO_OS === "android" ? { headerStyle: { backgroundColor: "#000000" } } : { headerTransparent: true });
  });
});

describe("inlineLargeTitleOptions", () => {
  it("opts into native inline-large styling without enabling collapsible headers", () => {
    expect(inlineLargeTitleOptions("#ffffff")).toEqual(process.env.EXPO_OS === "android" ? {} : {
      headerLargeTitleEnabled: false,
      headerStyle: { backgroundColor: "transparent" },
      unstable_nativeProps: {
        headerConfig: {
          largeTitleFontSize: 26,
          largeTitleFontWeight: "700",
          largeTitleColor: "#ffffff",
        },
      },
    });
  });
});
