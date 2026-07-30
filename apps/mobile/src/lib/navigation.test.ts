import {
  formSheetOptions,
  inlineLargeTitleOptions,
  nativeHeaderOptions,
} from "./navigation";

describe("formSheetOptions", () => {
  it("keeps elevated sheet chrome opaque and out of the content flow", () => {
    expect(formSheetOptions("#1c1c1e")).toEqual({
      presentation: "formSheet",
      headerTransparent: false,
      headerStyle: { backgroundColor: "#1c1c1e" },
      contentStyle: { backgroundColor: "#1c1c1e" },
    });
  });
});

describe("nativeHeaderOptions", () => {
  it("lets the first-child ScrollView drive UIKit's automatic scroll edge", () => {
    expect(nativeHeaderOptions("#000000")).toEqual({
      headerTransparent: true,
    });
  });
});

describe("inlineLargeTitleOptions", () => {
  it("opts into native inline-large styling without enabling collapsible headers", () => {
    expect(inlineLargeTitleOptions("#ffffff")).toEqual({
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
