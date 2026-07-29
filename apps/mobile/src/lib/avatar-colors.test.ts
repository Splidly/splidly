import { avatarColorOptions, avatarColorsFor } from "./avatar-colors";

describe("avatarColorsFor", () => {
  it("offers enough paired colors to keep lists varied", () => {
    expect(avatarColorOptions).toHaveLength(16);
    for (const option of avatarColorOptions) {
      expect(option.light.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.light.foreground).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.dark.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(option.dark.foreground).toMatch(/^#[0-9A-F]{6}$/);
    }
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
});
