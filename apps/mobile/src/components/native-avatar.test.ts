import { avatarColorsFor } from "../lib/avatar-colors";
import { nativeUserAvatar } from "./native-avatar";

it("uses the same initials and per-user palette as the other avatar components", () => {
  for (const scheme of ["light", "dark"] as const) {
    const colors = avatarColorsFor("person:alex", scheme);
    expect(nativeUserAvatar("  Alexandra   Morgan  ", "alex", scheme)).toEqual({
      initials: "AM", backgroundColor: colors.background, foregroundColor: colors.foreground,
    });
  }
});

it.each([["Bea", "B"], ["Élodie Müller", "ÉM"], ["", "?"]])("handles the name %s", (name, initials) => {
  expect(nativeUserAvatar(name!, "user", "light").initials).toBe(initials);
});
