import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useSegments } from "expo-router";
import { useColorScheme } from "react-native";
import { useTheme } from "../../theme";
import { androidFormHidesTabBar } from "../../lib/navigation";

// Android tab PNGs are rasterized Material Symbols (group, groups, person).
// XML image sources render empty in the native tab bar.
export default function TabsLayout() {
  const theme = useTheme();
  const segments = useSegments();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <NativeTabs
      hidden={androidFormHidesTabBar(segments)}
      tintColor={theme.primary}
      unstable_nativeProps={{
        colorScheme,
        nativeContainerStyle: { backgroundColor: theme.background },
      }}
    >
      <NativeTabs.Trigger name="friends">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          src={
            process.env.EXPO_OS === "android"
              ? require("../../../assets/icons/tab-friends.png")
              : undefined
          }
        />
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.3", selected: "person.3.fill" }}
          src={
            process.env.EXPO_OS === "android"
              ? require("../../../assets/icons/tab-groups.png")
              : undefined
          }
        />
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          src={
            process.env.EXPO_OS === "android"
              ? require("../../../assets/icons/tab-profile.png")
              : undefined
          }
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
