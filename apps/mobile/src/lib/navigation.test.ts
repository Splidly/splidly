import { formSheetOptions, inlineLargeTitleOptions } from "./navigation";

describe("formSheetOptions", () => {
  it("uses one elevated color for the native sheet and its header", () => {
    expect(formSheetOptions("#1c1c1e")).toEqual({
      presentation: "formSheet",
      headerStyle: { backgroundColor: "#1c1c1e" },
      contentStyle: { backgroundColor: "#1c1c1e" },
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
