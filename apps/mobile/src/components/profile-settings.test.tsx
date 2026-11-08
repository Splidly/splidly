import { act, render } from "@testing-library/react-native";
import * as Native from "react-native";
import { ProfileFooter, ProfileIdentity, ProfileSection, ProfileSettingRow } from "./profile-settings";
import { nativeProfileText, pressProfile, profileNode } from "../test-utils/native-profile";

beforeEach(() => {
  jest.spyOn(globalThis.expo, "getViewConfig").mockReturnValue({
    validAttributes: {}, directEventTypes: {},
  });
});
afterEach(() => jest.restoreAllMocks());

jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  // Native Material palette lookup is unavailable in Jest.
  return { ...actual, Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View> };
});

it("uses native text and buttons throughout the profile without enabling text selection", async () => {
  const view = await render(<>
    <ProfileIdentity name="Alex Morgan" userId="a" onPress={jest.fn()} />
    <ProfileSection title="Preferences" footer="New entries only">
      <ProfileSettingRow title="Home currency" subtitle="Euro" value="EUR" icon="currency" onPress={jest.fn()} />
    </ProfileSection>
    <ProfileFooter version="1.0" />
  </>);
  expect(view.container.queryAll((node) => node.type === "Text")).toHaveLength(0);
  expect(view.container.queryAll((node) => node.type === "View" && typeof node.props.onPress === "function")).toHaveLength(0);
  for (const label of ["Alex Morgan", "Preferences", "Home currency", "Euro", "EUR", "New entries only"]) {
    const text = nativeProfileText(view, label);
    expect(text).toHaveLength(1);
    if (process.env.EXPO_OS === "ios") {
      expect(text[0]!.props.modifiers).toContainEqual(expect.objectContaining({ $type: "textSelection", value: false }));
    }
  }
  expect(view.container.queryAll((node) => node.props.selectable === true)).toHaveLength(0);
});

it("stacks a long identity and preserves readable native text at larger accessibility sizes", async () => {
  const previous = Native.Dimensions.get("window");
  await act(() => { Native.Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1.6 } }); });
  try {
    const name = "Alexandra Morgan de la Cruz";
    const view = await render(<ProfileIdentity name={name} userId="a" onPress={jest.fn()} />);
    const layout = profileNode(view, "profile-identity-content");
    if (process.env.EXPO_OS === "ios") {
      expect(layout.props.alignment).toBe("leading");
      const text = nativeProfileText(view, name)[0]!;
      expect(text.props.modifiers).toContainEqual(expect.objectContaining({ $type: "font", size: 28 * 1.6 }));
      expect(text.props.modifiers).not.toContainEqual(expect.objectContaining({ $type: "lineLimit", limit: 1 }));
    } else expect(layout.props.horizontalAlignment).toBe("start");
    expect(nativeProfileText(view, name)).toHaveLength(1);
  } finally { await act(() => { Native.Dimensions.set({ window: previous }); }); }
});

it("centers each icon in one native tile and lets the native row own the interaction", async () => {
  const press = jest.fn();
  const view = await render(<ProfileSection title="Preferences">
    <ProfileSettingRow title="Notifications" icon="notifications" value="On" onPress={press} />
  </ProfileSection>);
  await pressProfile(view, "profile-setting-notifications");
  expect(press).toHaveBeenCalledTimes(1);
  const button = profileNode(view, "profile-setting-notifications");
  if (process.env.EXPO_OS === "ios") {
    const tiles = button.queryAll((node) => typeof node.type === "string" && node.props.modifiers?.some(
      (modifier: { $type: string; width?: number; height?: number; alignment?: string }) =>
        modifier.$type === "frame" && modifier.width === 36 && modifier.height === 36 && modifier.alignment === "center",
    ));
    expect(tiles).toHaveLength(1);
    expect(button.props.modifiers).toContainEqual(expect.objectContaining({ $type: "frame", minHeight: 48 }));
    expect(button.props.modifiers).not.toContainEqual(expect.objectContaining({ $type: "buttonStyle", style: "plain" }));
    expect(profileNode(view, "profile-setting-notifications-highlight")).toBeTruthy();
  } else {
    const tiles = button.queryAll((node) => typeof node.type === "string" && node.props.contentAlignment === "center" && node.props.modifiers?.some(
      (modifier: { $type: string; width?: number; height?: number }) => modifier.$type === "size" && modifier.width === 36 && modifier.height === 36,
    ));
    expect(tiles).toHaveLength(1);
    expect(button.props.contentPadding).toEqual({ start: 0, top: 0, end: 0, bottom: 0 });
  }
  expect(button.queryAll((node) => typeof node.type === "string" && typeof node.props.onPress === "function")).toHaveLength(0);
});

it("supports dark mode without relying on a light profile surface", async () => {
  const scheme = jest.spyOn(Native, "useColorScheme").mockReturnValue("dark");
  try {
    const view = await render(<ProfileIdentity name="Alex" userId="a" onPress={jest.fn()} />);
    if (process.env.EXPO_OS === "ios") {
      expect(profileNode(view, "profile-identity-highlight").props).toMatchObject({
        backgroundColor: "#202039", cornerRadius: 28,
      });
      expect(profileNode(view, "profile-identity-content").props.modifiers).not.toContainEqual(
        expect.objectContaining({ $type: "background" }),
      );
    } else {
      expect(profileNode(view, "profile-identity-content").props.modifiers).toContainEqual(
        expect.objectContaining({ $type: "background", color: "#202039" }),
      );
    }
  } finally { scheme.mockRestore(); }
});

it("keeps profile actions inside an existing SwiftUI group when the installed binary lacks the highlight view", async () => {
  jest.spyOn(globalThis.expo, "getViewConfig").mockReturnValue(null);
  const press = jest.fn();
  const view = await render(<ProfileIdentity name="Alex" userId="a" onPress={press} />);
  if (process.env.EXPO_OS === "ios") {
    const fallback = profileNode(view, "profile-identity-highlight");
    expect(fallback.props.modifiers).toContainEqual(expect.objectContaining({
      $type: "backgroundOverlay", color: "#EEEEFF",
    }));
    expect(fallback.props.modifiers).toContainEqual(expect.objectContaining({
      $type: "clipShape", cornerRadius: 28,
    }));
    expect(view.container.queryAll((node) => typeof node.type === "string" && node.type.includes("SplidlySwipe"))).toHaveLength(0);
  }
  await pressProfile(view, "profile-identity");
  expect(press).toHaveBeenCalledTimes(1);
});
