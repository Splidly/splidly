import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "react-native";
import { useTheme } from "../../theme";

export default function TabsLayout() {
  const theme = useTheme();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <NativeTabs
      tintColor={theme.primary}
      unstable_nativeProps={{
        colorScheme,
        nativeContainerStyle: { backgroundColor: theme.background },
      }}
    >
      <NativeTabs.Trigger name="friends">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md="people"
        />
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.3", selected: "person.3.fill" }}
          md="groups"
        />
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
