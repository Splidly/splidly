import {
  avatarColorOptions,
  avatarColorsFor,
  semanticChartColorFor,
  semanticIconColorsFor,
} from "./avatar-colors";

describe("avatarColorsFor", () => {
  it("offers enough paired colors to keep lists varied", () => {
    expect(avatarColorOptions).toHaveLength(16);
    for (const option of avatarColorOptions) {
      expect(option.light.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.light.foreground).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.dark.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.dark.foreground).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.chart.light).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.chart.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(
      new Set(avatarColorOptions.map((option) => option.chart.light)).size,
    ).toBe(avatarColorOptions.length);
    expect(
      new Set(avatarColorOptions.map((option) => option.chart.dark)).size,
    ).toBe(avatarColorOptions.length);
  });

  it("keeps an entity's selection stable across color schemes", () => {
    const light = avatarColorsFor("person:user-123", "light");
    const dark = avatarColorsFor("person:user-123", "dark");

    expect(light.name).toBe(dark.name);
    expect(light.background).not.toBe(dark.background);
    expect(avatarColorsFor("person:user-123", "light")).toEqual(light);
  });

  it("distributes ordinary entity identifiers across the palette", () => {
    const selections = new Set(
      Array.from({ length: 32 }, (_, index) =>
        avatarColorsFor(`group:group-${index}`, "light").name,
      ),
    );

    expect(selections.size).toBeGreaterThanOrEqual(12);
  });

  it("inverts only light semantic icons to use the saturated tile color", () => {
    const lightAvatar = avatarColorsFor("group:group-1", "light");
    const lightIcon = semanticIconColorsFor("group:group-1", "light");
    const darkAvatar = avatarColorsFor("group:group-1", "dark");
    const darkIcon = semanticIconColorsFor("group:group-1", "dark");

    expect(lightIcon).toEqual({
      name: lightAvatar.name,
      background: lightAvatar.foreground,
      foreground: lightAvatar.background,
    });
    expect(darkIcon).toEqual(darkAvatar);
  });

  it("uses vivid, stable category hues for charts", () => {
    expect(semanticChartColorFor("expense:dining", "light")).toBe(
      "#C58E00",
    );
    expect(semanticChartColorFor("expense:dining", "dark")).toBe(
      "#FFD60A",
    );
    expect(semanticChartColorFor("expense:other", "light")).toBe(
      "#008F83",
    );
    expect(semanticChartColorFor("expense:other", "dark")).toBe(
      "#00C7BE",
    );
  });
});
