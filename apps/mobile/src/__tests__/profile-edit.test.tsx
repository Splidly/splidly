import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import EditProfileScreen from "../app/(tabs)/profile/edit";

import { changeProfileName, nativeProfileText, pressProfile, profileNode } from "../test-utils/native-profile";

let viewConfig: jest.SpyInstance;
beforeEach(() => {
  viewConfig = jest.spyOn(globalThis.expo, "getViewConfig").mockReturnValue({
    validAttributes: {}, directEventTypes: {},
  });
});
afterEach(() => viewConfig.mockRestore());

jest.mock("@expo/ui", () => ({
  ...jest.requireActual("@expo/ui"),
  useNativeState: require("../test-utils/native-profile").useMockNativeState,
}));
jest.mock("@expo/ui/swift-ui", () => ({
  ...jest.requireActual("@expo/ui/swift-ui"),
  useNativeState: require("../test-utils/native-profile").useMockNativeState,
}));
jest.mock("@expo/ui/jetpack-compose", () => {
  const actual = jest.requireActual("@expo/ui/jetpack-compose");
  const { View } = require("react-native");
  return {
    ...actual,
    useNativeState: require("../test-utils/native-profile").useMockNativeState,
    Host: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <View {...props}>{children}</View>,
  };
});

const mockSave = jest.fn();
const mockSetData = jest.fn();
const mockInvalidate = jest.fn(async () => undefined);
const mockPickImage = jest.fn();
const profile = { userId: "user-1", displayName: "Lasse", homeCurrency: "EUR", avatarUrl: null };

jest.mock("../lib/custom-image", () => ({ pickCustomImage: () => mockPickImage() }));

jest.mock("expo-router", () => {
  const { Pressable } = require("react-native");
  const Toolbar = Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Button: ({ accessibilityLabel, onPress, disabled }: { accessibilityLabel: string; onPress: () => void; disabled: boolean }) => (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={disabled} />
    ) },
  );
  return { router: { back: jest.fn() }, Stack: { Screen: () => null, Toolbar } };
});

jest.mock("../lib/trpc", () => ({ api: {
  profile: {
    me: { useQuery: () => ({ data: profile, isPending: false, error: null }) },
    update: { useMutation: ({ onSuccess }: { onSuccess: (value: unknown) => Promise<void> }) => ({
      isPending: false, error: null,
      mutateAsync: async (input: unknown) => {
        const updated = await mockSave(input);
        await onSuccess(updated);
        return updated;
      },
    }) },
  },
  useUtils: () => ({
    profile: { me: { setData: mockSetData } },
    friends: { list: { invalidate: mockInvalidate } },
    groups: { invalidate: mockInvalidate },
  }),
} }));

function fixture() {
  return <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <EditProfileScreen />
  </SafeAreaInsetsContext.Provider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ ...profile, displayName: "New name" });
  mockPickImage.mockReset();
});

function saveDisabled(view: Awaited<ReturnType<typeof render>>) {
  if (process.env.EXPO_OS === "android") return !profileNode(view, "profile-save").props.enabled;
  return view.getByLabelText("Save profile").props.accessibilityState.disabled;
}
async function save(view: Awaited<ReturnType<typeof render>>) {
  if (process.env.EXPO_OS === "android") await pressProfile(view, "profile-save");
  else await fireEvent.press(view.getByLabelText("Save profile"));
}
async function cancel(view: Awaited<ReturnType<typeof render>>) {
  if (process.env.EXPO_OS === "android") await pressProfile(view, "profile-cancel");
  else await fireEvent.press(view.getByLabelText("Cancel profile changes"));
}

it("keeps edits as a draft until Save, then updates the identity without changing currency or photo", async () => {
  const view = await render(fixture());
  expect(view.container.queryAll((node) => node.props.autoFocus === true)).toHaveLength(0);
  expect(saveDisabled(view)).toBe(true);
  await changeProfileName(view, "  New name  ");
  expect(mockSave).not.toHaveBeenCalled();
  await save(view);
  expect(mockSave).toHaveBeenCalledWith({ displayName: "New name", homeCurrency: "EUR" });
  expect(mockSetData).toHaveBeenCalledWith(undefined, { ...profile, displayName: "New name" });
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("discards the draft when canceled and rejects an empty name", async () => {
  const view = await render(fixture());
  await changeProfileName(view, "   ");
  expect(saveDisabled(view)).toBe(true);
  await cancel(view);
  expect(mockSave).not.toHaveBeenCalled();
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("preserves the draft after a failed save", async () => {
  mockSave.mockRejectedValueOnce(new Error("Connection lost"));
  const view = await render(fixture());
  await changeProfileName(view, "New name");
  await save(view);
  expect(router.back).not.toHaveBeenCalled();
  await save(view);
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenLastCalledWith({ displayName: "New name", homeCurrency: "EUR" });
});

it("blocks repeated saves and does not pop another screen if dismissed during the request", async () => {
  let finish!: (value: typeof profile) => void;
  mockSave.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = await render(fixture());
  await changeProfileName(view, "New name");
  await save(view);
  await save(view);
  expect(mockSave).toHaveBeenCalledTimes(1);
  await view.unmount();
  await act(async () => { finish({ ...profile, displayName: "New name" }); });
  expect(router.back).not.toHaveBeenCalled();
});

it("provides reachable save and cancel controls on the current native platform", async () => {
  const view = await render(fixture());
  if (process.env.EXPO_OS === "android") {
    expect(nativeProfileText(view, "Edit profile")).toHaveLength(1);
    expect(profileNode(view, "profile-cancel")).toBeTruthy();
  } else expect(view.getByLabelText("Cancel profile changes")).toBeTruthy();
  await changeProfileName(view, "New name");
  await save(view);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("waits for photo preparation, previews the selection natively and saves it only on request", async () => {
  let finish!: (value: string) => void;
  const photo = "data:image/jpeg;base64,AA==";
  mockPickImage.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = await render(fixture());
  await changeProfileName(view, "New name");
  await pressProfile(view, "profile-change-photo");
  await pressProfile(view, "profile-change-photo");
  expect(mockPickImage).toHaveBeenCalledTimes(1);
  expect(saveDisabled(view)).toBe(true);
  await act(async () => { finish(photo); });
  expect(mockSave).not.toHaveBeenCalled();
  expect(saveDisabled(view)).toBe(false);
  const images = view.container.queryAll((node) => typeof node.type === "string" && (
    node.props.uiImage === photo || node.props.source?.uri === photo
  ));
  expect(images).toHaveLength(1);
  await save(view);
  expect(mockSave).toHaveBeenCalledWith({ displayName: "New name", homeCurrency: "EUR", avatarUrl: photo });
});

it("can remove a selected photo from the draft without updating the account", async () => {
  mockPickImage.mockResolvedValue("data:image/jpeg;base64,AA==");
  const view = await render(fixture());
  await pressProfile(view, "profile-change-photo");
  expect(saveDisabled(view)).toBe(false);
  await pressProfile(view, "profile-remove-photo");
  expect(saveDisabled(view)).toBe(true);
  expect(mockSave).not.toHaveBeenCalled();
});
