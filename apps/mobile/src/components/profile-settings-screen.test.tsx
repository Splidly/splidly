import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { ProfileSettingsScreen } from "./profile-settings-screen.ios";
import { ProfileFooter, ProfileIdentity, ProfileSection, ProfileSettingRow } from "./profile-settings";
import { ErrorState } from "./ui";

let mockAvatarFile: string | undefined;
jest.mock("./activity-avatar.ios", () => ({
  ...jest.requireActual("./activity-avatar.ios"),
  useAvatarFile: () => mockAvatarFile,
}));

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

it("uses native account and value cells and updates their values, disabled state and cached photo", async () => {
  const edit = jest.fn();
  const currency = jest.fn();
  const fixture = (value: string, disabled = false, error = false) => (
    <SafeAreaInsetsContext.Provider value={insets}>
      <ProfileSettingsScreen>
        <ProfileIdentity name="Alexandra Morgan" userId="alex" imageUrl="https://example.com/avatar.jpg" onPress={edit} />
        <ProfileSection title="Preferences" footer="Applies to new expenses.">
          <ProfileSettingRow title="Home currency" icon="currency" value={value} onPress={currency} disabled={disabled} />
        </ProfileSection>
        <ProfileFooter version="1.2.3" />
        {error ? <ErrorState message="Could not save profile" /> : null}
      </ProfileSettingsScreen>
    </SafeAreaInsetsContext.Provider>
  );
  mockAvatarFile = undefined;
  const view = await render(fixture("EUR"));
  let list = view.getByTestId("native-activity-list");
  expect(list.props.sections[1].rows[0].settings).toMatchObject({
    title: "Alexandra Morgan", identity: true, showsDisclosure: true,
    avatarFallback: { initials: "AM", backgroundColor: expect.any(String), foregroundColor: expect.any(String) },
  });
  expect(list.props.sections[2]).toMatchObject({
    headerTitle: "Preferences", footerTitle: "Applies to new expenses.\n\nSplidly 1.2.3",
  });
  expect(list.props.sections[2].rows[0].settings).toMatchObject({ value: "EUR", enabled: true });
  expect(view.queryByTestId("profile-identity-content")).toBeNull();
  expect(view.queryByTestId("profile-setting-currency")).toBeNull();
  await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "profile-identity" } });
  expect(edit).toHaveBeenCalledTimes(1);

  mockAvatarFile = "file:///tmp/alex.jpg";
  await view.rerender(fixture("USD", true));
  list = view.getByTestId("native-activity-list");
  expect(list.props.sections[1].rows[0].settings.imageUri).toBe(mockAvatarFile);
  expect(list.props.sections[2].rows[0]).toMatchObject({
    selectable: false, settings: { value: "USD", enabled: false },
  });
  await fireEvent(list, "rowPress", { nativeEvent: { rowKey: "profile-setting-currency" } });
  expect(currency).not.toHaveBeenCalled();
  await view.rerender(fixture("USD", false, true));
  list = view.getByTestId("native-activity-list");
  expect(list.props.sections[2].footerTitle).toContain("Splidly 1.2.3");
  expect(list.props.sections.at(-1).key).toBe("profile-messages");
  expect(view.getByText("Could not save profile")).toBeTruthy();
  mockAvatarFile = undefined;
});

it("keeps the initials fallback when a profile photo is added and removed", async () => {
  mockAvatarFile = undefined;
  const fixture = (imageUrl: string | null) => <SafeAreaInsetsContext.Provider value={insets}>
    <ProfileSettingsScreen>
      <ProfileIdentity name="Bea Chen" userId="bea" imageUrl={imageUrl} onPress={jest.fn()} />
    </ProfileSettingsScreen>
  </SafeAreaInsetsContext.Provider>;
  const view = await render(fixture(null));
  const settings = () => view.getByTestId("native-activity-list").props.sections[1].rows[0].settings;
  expect(settings().avatarFallback.initials).toBe("BC");
  expect(settings().imageUri).toBeUndefined();
  await view.rerender(fixture("data:image/jpeg;base64,PHOTO"));
  expect(settings().imageUri).toBe("data:image/jpeg;base64,PHOTO");
  await view.rerender(fixture(null));
  expect(settings().imageUri).toBeUndefined();
  expect(settings().avatarFallback.initials).toBe("BC");
});
