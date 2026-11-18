import { fireEvent, render } from "@testing-library/react-native";
import { ProfileIdentity, ProfileSection, ProfileSettingRow } from "./profile-settings.android";

jest.mock("@expo/ui", () => ({
  Icon: Object.assign(() => null, { select: (sources: { android: Promise<unknown> }) => { void sources.android.catch(() => null); return "icon"; } }),
}));
jest.mock("@expo/ui/jetpack-compose", () => ({
  Host: ({ children }: { children: React.ReactNode }) => children,
}));

it("keeps Android profile actions reachable with long names and non-selectable text", async () => {
  const edit = jest.fn();
  const currency = jest.fn();
  const view = await render(<>
    <ProfileIdentity name="Alexandra Morgan with a long display name" userId="alex" onPress={edit} />
    <ProfileSection title="Preferences">
      <ProfileSettingRow title="Home currency" value="Euro" icon="currency" onPress={currency} />
      <ProfileSettingRow title="Notifications" icon="notifications" onPress={jest.fn()} disabled />
    </ProfileSection>
  </>);
  await fireEvent.press(view.getByTestId("profile-identity"));
  await fireEvent.press(view.getByTestId("profile-setting-currency"));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(currency).toHaveBeenCalledTimes(1);
  expect(view.getByText("Home currency").props.selectable).toBe(false);
  expect(view.getByText("Alexandra Morgan with a long display name").props.selectable).toBe(false);
  expect(view.getByTestId("profile-setting-notifications").props.accessibilityState.disabled).toBe(true);
  expect(view.getByTestId("profile-setting-currency").queryAll(
    (node) => node.props.pointerEvents === "none",
  )).toHaveLength(1);
});
